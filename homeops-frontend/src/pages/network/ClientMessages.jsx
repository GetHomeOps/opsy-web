import React, {useState, useEffect, useRef, useCallback} from "react";
import {useSearchParams} from "react-router-dom";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import AppApi from "../../api/api";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {useAuth} from "../../context/AuthContext";
import ConversationSidebar from "./partials/ConversationSidebar";
import ConversationHeader from "./partials/ConversationHeader";
import ConversationBody from "./partials/ConversationBody";
import ConversationFooter from "./partials/ConversationFooter";

const POLL_CONVERSATIONS_MS = 15000;
const POLL_MESSAGES_MS = 10000;

function ClientMessages() {
  const contentArea = useRef(null);
  const {currentAccount} = useCurrentAccount();
  const {currentUser} = useAuth();
  const isHomeownerViewer = currentUser?.role === "homeowner";
  const [searchParams, setSearchParams] = useSearchParams();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [msgSidebarOpen, setMsgSidebarOpen] = useState(true);

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [selectedConvId, setSelectedConvId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const selectedConv = conversations.find((c) => c.id === selectedConvId) || null;

  // Fetch conversations list (homeowners: /conversations/mine; agents/admins: account-scoped)
  const fetchConversations = useCallback(async (silent = false) => {
    if (isHomeownerViewer) {
      if (!currentUser?.id) return;
    } else if (!currentAccount?.id) {
      return;
    }
    try {
      if (!silent) setLoadingConversations(true);
      const list = isHomeownerViewer
        ? await AppApi.getMyConversations()
        : await AppApi.getConversations(currentAccount.id);
      setConversations(list);
    } catch {
      if (!silent) setConversations([]);
    } finally {
      if (!silent) setLoadingConversations(false);
    }
  }, [isHomeownerViewer, currentAccount?.id, currentUser?.id]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Poll conversations
  useEffect(() => {
    if (isHomeownerViewer ? !currentUser?.id : !currentAccount?.id) return;
    const interval = setInterval(() => fetchConversations(true), POLL_CONVERSATIONS_MS);
    return () => clearInterval(interval);
  }, [isHomeownerViewer, currentAccount?.id, currentUser?.id, fetchConversations]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (convId, silent = false) => {
    if (!convId) return;
    try {
      if (!silent) setLoadingMessages(true);
      const list = await AppApi.getConversationMessages(convId);
      setMessages(list);
    } catch {
      if (!silent) setMessages([]);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId);
      AppApi.markConversationRead(selectedConvId).catch(() => {});
    } else {
      setMessages([]);
    }
  }, [selectedConvId, fetchMessages]);

  // Poll messages for active conversation
  useEffect(() => {
    if (!selectedConvId) return;
    const interval = setInterval(() => fetchMessages(selectedConvId, true), POLL_MESSAGES_MS);
    return () => clearInterval(interval);
  }, [selectedConvId, fetchMessages]);

  // Auto-select from highlight param
  useEffect(() => {
    const highlightId = searchParams.get("conversation");
    if (highlightId && !loadingConversations) {
      const id = parseInt(highlightId, 10);
      if (!Number.isNaN(id)) setSelectedConvId(id);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("conversation");
        return next;
      }, {replace: true});
    }
  }, [searchParams, loadingConversations, setSearchParams]);

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (!selectedConvId && conversations.length > 0 && !loadingConversations) {
      setSelectedConvId(conversations[0].id);
    }
  }, [conversations, selectedConvId, loadingConversations]);

  const handleSelectConversation = (convId) => {
    setSelectedConvId(convId);
    setMsgSidebarOpen(false);
  };

  const handleMessageSent = useCallback(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId, true);
    }
    fetchConversations(true);
  }, [selectedConvId, fetchMessages, fetchConversations]);

  useEffect(() => {
    if (contentArea.current) {
      contentArea.current.scrollTop = msgSidebarOpen ? 0 : 99999999;
    }
  }, [msgSidebarOpen]);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} variant="v2" />

      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden" ref={contentArea}>
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} variant="v2" />

        <main className="grow">
          <div className="relative flex h-full">
            <ConversationSidebar
              conversations={conversations}
              loading={loadingConversations}
              selectedConvId={selectedConvId}
              onSelect={handleSelectConversation}
              msgSidebarOpen={msgSidebarOpen}
              setMsgSidebarOpen={setMsgSidebarOpen}
              forHomeowner={isHomeownerViewer}
            />

            <div
              className={`grow flex flex-col md:translate-x-0 transition-transform duration-300 ease-in-out ${
                msgSidebarOpen ? "translate-x-1/3" : "translate-x-0"
              }`}
            >
              {selectedConv ? (
                <>
                  <ConversationHeader
                    conversation={selectedConv}
                    msgSidebarOpen={msgSidebarOpen}
                    setMsgSidebarOpen={setMsgSidebarOpen}
                    forHomeowner={isHomeownerViewer}
                  />
                  <ConversationBody
                    messages={messages}
                    loading={loadingMessages}
                    conversation={selectedConv}
                    currentUserId={currentUser?.id}
                  />
                  <ConversationFooter
                    conversationId={selectedConvId}
                    onMessageSent={handleMessageSent}
                    accountId={currentAccount?.id}
                  />
                </>
              ) : loadingConversations ? (
                <div className="grow flex flex-col">
                  {/* Skeleton conversation header */}
                  <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700/60 px-4 sm:px-6 md:px-5 h-16">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                      <div className="space-y-1.5">
                        <div className="h-3.5 w-28 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                        <div className="h-2.5 w-40 rounded bg-gray-100 dark:bg-gray-700/60 animate-pulse" />
                      </div>
                    </div>
                  </div>
                  {/* Skeleton message bubbles */}
                  <div className="grow px-4 sm:px-6 md:px-5 py-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse shrink-0" />
                      <div className="space-y-2 max-w-[60%]">
                        <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                        <div className="h-14 w-48 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
                      </div>
                    </div>
                    <div className="flex items-start gap-3 flex-row-reverse">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse shrink-0" />
                      <div className="h-10 w-40 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse shrink-0" />
                      <div className="h-16 w-56 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grow flex items-center justify-center">
                  <div className="text-center px-6">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      No conversations yet
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
                      {isHomeownerViewer
                        ? "When you message your agent from a property, the conversation will appear here."
                        : "When a homeowner contacts you through their property dashboard, the conversation will appear here."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default ClientMessages;
