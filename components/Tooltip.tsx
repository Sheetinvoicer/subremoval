'use client';
import React from 'react';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';

type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

export function TooltipProvider({ children }) {
  return <TooltipPrimitive.Provider>{children}</TooltipPrimitive.Provider>;
}

export function Tooltip({ children, content, side = 'top' }: { children: React.ReactNode; content: React.ReactNode; side?: TooltipSide }) {
  return (
    <TooltipPrimitive.Root delayDuration={200}>
      <TooltipPrimitive.Trigger asChild>
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          className="z-50 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg shadow-lg"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-gray-900" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
