import React, { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import Transition from "../../../utils/Transition";

function LightboxModal({ photos, initialIndex = 0, isOpen, onClose }) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const prev = useCallback(() => {
    setIndex((i) => (i === 0 ? photos.length - 1 : i - 1));
  }, [photos.length]);

  const next = useCallback(() => {
    setIndex((i) => (i === photos.length - 1 ? 0 : i + 1));
  }, [photos.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose, prev, next]);

  if (photos.length === 0) return null;

  const photo = photos[index];

  return (
    <>
      <Transition
        show={isOpen}
        enter="transition ease-out duration-200"
        enterStart="opacity-0"
        enterEnd="opacity-100"
        leave="transition ease-in duration-150"
        leaveStart="opacity-100"
        leaveEnd="opacity-0"
        className="fixed inset-0 bg-black/90 z-[300] flex items-center justify-center"
        onClick={onClose}
      >
        <div
          className="relative w-full h-full max-w-5xl max-h-[90vh] mx-4 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex-1 flex items-center justify-center min-h-0 relative">
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-10 focus:outline-none focus:ring-2 focus:ring-white/50"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-10 focus:outline-none focus:ring-2 focus:ring-white/50"
                  aria-label="Next"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
            <img
              src={photo.url}
              alt={photo.caption}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
          </div>

          <div className="px-4 py-3 bg-black/40 rounded-b-lg">
            <p className="text-sm text-white/90 font-medium">{photo.caption}</p>
            <p className="text-xs text-white/60 mt-0.5">
              {index + 1} of {photos.length}
            </p>
          </div>
        </div>
      </Transition>
    </>
  );
}

export default LightboxModal;
