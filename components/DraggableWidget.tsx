'use client'

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Maximize2, Minimize2 } from 'lucide-react';
import { useState } from 'react';

export default function DraggableWidget({ id, title, children, onRemove, onResize, isResizable = true }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleResize = () => {
    setIsExpanded(!isExpanded);
    if (onResize) onResize(id, !isExpanded);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-200 ${
        isExpanded ? 'col-span-2 row-span-2' : ''
      }`}
    >
      {/* Widget Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 cursor-move" {...attributes} {...listeners}>
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          {isResizable && (
            <button
              onClick={handleResize}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              {isExpanded ? (
                <Minimize2 className="w-3 h-3 text-gray-500 dark:text-gray-400" />
              ) : (
                <Maximize2 className="w-3 h-3 text-gray-500 dark:text-gray-400" />
              )}
            </button>
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(id)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
            >
              <X className="w-3 h-3 text-gray-500 dark:text-gray-400 hover:text-red-500" />
            </button>
          )}
        </div>
      </div>
      
      {/* Widget Content */}
      <div className={`p-4 ${isExpanded ? 'min-h-[400px]' : 'min-h-[200px]'}`}>
        {children}
      </div>
    </div>
  );
}
