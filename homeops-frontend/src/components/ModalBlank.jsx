import React, {useRef, useEffect} from "react";
import Transition from "../utils/Transition";

function ModalBlank({
  children,
  id,
  modalOpen,
  setModalOpen,
  closeOnClickOutside = true,
  closeOnBackdropClick = true,
  contentClassName,
  ignoreClickRef,
}) {
  const modalContent = useRef(null);
  const isOpen = modalOpen === true;

  // close on click outside (when enabled)
  useEffect(() => {
    if (!closeOnClickOutside) return;
    const clickHandler = ({target}) => {
      if (!isOpen) return;
      if (modalContent.current?.contains(target)) return;
      // Ignore clicks on the trigger button (e.g. Preview) so opening click doesn't immediately close
      if (ignoreClickRef?.current?.contains(target)) return;
      // Ignore clicks on detached nodes (e.g. dropdown options that unmount on select)
      if (target && !document.body.contains(target)) return;
      setModalOpen(false);
    };
    document.addEventListener("click", clickHandler);
    return () => document.removeEventListener("click", clickHandler);
  }, [isOpen, closeOnClickOutside, setModalOpen, ignoreClickRef]);

  // close if the esc key is pressed
  useEffect(() => {
    const keyHandler = ({keyCode}) => {
      if (!isOpen || keyCode !== 27) return;
      setModalOpen(false);
    };
    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  }, [isOpen, setModalOpen]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && closeOnBackdropClick)
      setModalOpen(false);
  };

  return (
    <>
      {/* Modal backdrop - click to close, z-[200] ensures modals appear above floating elements like ImageUploadField (z-[100]) */}
      <Transition
        className={`fixed inset-0 bg-gray-900/30 z-[200] transition-opacity cursor-default ${
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        show={isOpen}
        appear={true}
        enter="transition ease-out duration-200"
        enterStart="opacity-0"
        enterEnd="opacity-100"
        leave="transition ease-out duration-100"
        leaveStart="opacity-100"
        leaveEnd="opacity-0"
        aria-hidden="true"
        onClick={handleBackdropClick}
      />
      {/* Modal dialog */}
      <Transition
        id={id}
        className="fixed inset-0 z-[200] overflow-hidden flex items-center my-4 justify-center px-4 sm:px-6"
        role="dialog"
        aria-modal="true"
        show={isOpen}
        appear={true}
        enter="transition ease-in-out duration-200"
        enterStart="opacity-0 translate-y-4"
        enterEnd="opacity-100 translate-y-0"
        leave="transition ease-in-out duration-200"
        leaveStart="opacity-100 translate-y-0"
        leaveEnd="opacity-0 translate-y-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalOpen(false);
        }}
      >
        <div
          ref={modalContent}
          onClick={(e) => e.stopPropagation()}
          className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-auto w-full max-h-full ${contentClassName ?? "max-w-2xl"}`}
        >
          {children}
        </div>
      </Transition>
    </>
  );
}

export default ModalBlank;
