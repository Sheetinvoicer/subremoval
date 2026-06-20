'use client'

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { createClient } from '@/lib/supabase/client';
import { Layout, Save, RotateCcw, GripVertical, X, Maximize2, Minimize2 } from 'lucide-react';
import toast from 'react-hot-toast';

// Available widgets
const AVAILABLE_WIDGETS = [
  { id: 'stats', name: 'Statistics Cards', defaultEnabled: true, resizable: false },
  { id: 'revenueChart', name: 'Revenue Chart', defaultEnabled: true, resizable: true },
  { id: 'invoiceChart', name: 'Invoice Volume', defaultEnabled: true, resizable: true },
  { id: 'valueChart', name: 'Average Value', defaultEnabled: true, resizable: true },
  { id: 'recentInvoices', name: 'Recent Invoices', defaultEnabled: true, resizable: false },
  { id: 'activities', name: 'Recent Activities', defaultEnabled: true, resizable: false },
  { id: 'quickActions', name: 'Quick Actions', defaultEnabled: true, resizable: false },
];

function DraggableWidget({ id, title, children, onRemove, onResize, isResizable = true }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const handleResize = () => {
    setIsExpanded(!isExpanded);
    if (onResize) onResize(id, !isExpanded);
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-200`}>
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 cursor-move">
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
      <div className={`p-4 ${isExpanded ? 'min-h-[400px]' : 'min-h-[200px]'}`}>
        {children}
      </div>
    </div>
  );
}

export default function CustomizableDashboard({ widgetContent }) {
  const [items, setItems] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    loadSavedLayout();
  }, []);

  const loadSavedLayout = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('user_preferences')
          .select('dashboard_layout')
          .eq('user_id', user.id)
          .single();
        
        if (data?.dashboard_layout && data.dashboard_layout.length > 0) {
          setItems(data.dashboard_layout);
        } else {
          const defaultItems = AVAILABLE_WIDGETS.filter(w => w.defaultEnabled).map(w => w.id);
          setItems(defaultItems);
        }
      } else {
        const defaultItems = AVAILABLE_WIDGETS.filter(w => w.defaultEnabled).map(w => w.id);
        setItems(defaultItems);
      }
    } catch (error) {
      const defaultItems = AVAILABLE_WIDGETS.filter(w => w.defaultEnabled).map(w => w.id);
      setItems(defaultItems);
    }
  };

  const saveLayout = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            dashboard_layout: items,
            updated_at: new Date().toISOString(),
          });
        toast.success('Layout saved successfully!');
      }
    } catch (error) {
      toast.error('Failed to save layout');
    }
    setSaving(false);
    setIsEditMode(false);
  };

  const resetLayout = () => {
    const defaultItems = AVAILABLE_WIDGETS.filter(w => w.defaultEnabled).map(w => w.id);
    setItems(defaultItems);
    toast.success('Layout reset to default');
  };

  const toggleWidget = (widgetId) => {
    if (items.includes(widgetId)) {
      setItems(items.filter(id => id !== widgetId));
    } else {
      setItems([...items, widgetId]);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setItems((prevItems) => {
        const oldIndex = prevItems.indexOf(active.id);
        const newIndex = prevItems.indexOf(over.id);
        return arrayMove(prevItems, oldIndex, newIndex);
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!mounted) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={() => setIsEditMode(!isEditMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            isEditMode
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <Layout className="w-4 h-4" />
          {isEditMode ? 'Exit Edit Mode' : 'Customize Layout'}
        </button>
        
        {isEditMode && (
          <>
            <button
              onClick={saveLayout}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Layout'}
            </button>
            <button
              onClick={resetLayout}
              className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </>
        )}
      </div>

      {isEditMode && (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Toggle Widgets</h3>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_WIDGETS.map((widget) => (
              <button
                key={widget.id}
                onClick={() => toggleWidget(widget.id)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  items.includes(widget.id)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {widget.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Drag widgets to reorder. Click X to remove from dashboard.
          </p>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="space-y-6">
            {items.map((itemId) => (
              <DraggableWidget
                key={itemId}
                id={itemId}
                title={AVAILABLE_WIDGETS.find(w => w.id === itemId)?.name || itemId}
                onRemove={isEditMode ? (id) => setItems(items.filter(i => i !== id)) : null}
                isResizable={AVAILABLE_WIDGETS.find(w => w.id === itemId)?.resizable || false}
              >
                {widgetContent[itemId] ? widgetContent[itemId] : <div>Loading...</div>}
              </DraggableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
