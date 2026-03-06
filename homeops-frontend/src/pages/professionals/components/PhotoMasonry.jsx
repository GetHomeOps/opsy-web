import React, { useState } from "react";
import { Camera } from "lucide-react";
import LightboxModal from "./LightboxModal";

function PhotoMasonry({ photos = [], onViewAll, scrollToPhotos }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Project Photos
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Camera className="w-3.5 h-3.5" />
              {photos.length} photos
            </span>
            {photos.length > 0 && (
              <button
                type="button"
                onClick={scrollToPhotos || onViewAll}
                className="text-xs font-semibold text-[#456564] dark:text-[#7aa3a2] hover:underline"
              >
                View all photos
              </button>
            )}
          </div>
        </div>

        <div
          className="columns-2 sm:columns-3 gap-3 space-y-3"
          style={{ columnGap: "0.75rem" }}
        >
          {photos.map((photo, idx) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => openLightbox(idx)}
              className="block w-full rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-[#456564]/40 dark:focus:ring-[#7aa3a2]/40 focus:ring-offset-2"
            >
              <div className="relative break-inside-avoid mb-3">
                <img
                  src={photo.url}
                  alt={photo.caption}
                  className="w-full rounded-xl object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors rounded-xl" />
              </div>
            </button>
          ))}
        </div>
      </div>

      <LightboxModal
        photos={photos}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}

export default PhotoMasonry;
