import React from "react";
import {Link, useParams} from "react-router-dom";
import {FileQuestion, ArrowLeft, LayoutGrid} from "lucide-react";

/**
 * Shown when the requested property does not exist (404 or 403 "Property not found").
 * Renders within the property layout so sidebar/navbar remain.
 */
function PropertyNotFound() {
  const {accountUrl} = useParams();

  const propertiesListUrl = accountUrl ? `/${accountUrl}/properties` : "/";

  return (
    <div className="max-w-lg mx-auto py-12 px-4 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 mb-6">
        <FileQuestion className="w-8 h-8" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Property not found
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        This property doesn't exist or the link may be incorrect. Check the
        address or go back to your properties list.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to={propertiesListUrl}
          className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white inline-flex items-center justify-center gap-2"
        >
          <LayoutGrid className="w-4 h-4" />
          Back to properties
        </Link>
        <Link
          to={accountUrl ? `/${accountUrl}/home` : "/"}
          className="btn bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 inline-flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
      </div>
    </div>
  );
}

export default PropertyNotFound;
