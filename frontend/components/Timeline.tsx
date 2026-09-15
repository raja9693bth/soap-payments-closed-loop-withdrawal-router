import React from 'react';
import { TimelineEvent } from '@/types';
import { formatDateTime } from '@/lib/api';
import { CheckCircle2, Clock, XCircle, ArrowRightCircle } from 'lucide-react';

interface TimelineProps {
  events: TimelineEvent[];
}

export const Timeline: React.FC<TimelineProps> = ({ events }) => {
  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
      {events.map((event, idx) => {
        let Icon = ArrowRightCircle;
        let iconColor = 'text-blue-600 bg-blue-50';

        if (event.event.includes('settled') || event.event.includes('created')) {
          Icon = CheckCircle2;
          iconColor = 'text-emerald-600 bg-emerald-50';
        } else if (event.event.includes('failed')) {
          Icon = XCircle;
          iconColor = 'text-rose-600 bg-rose-50';
        } else if (event.event.includes('pending') || event.event.includes('submitted')) {
          Icon = Clock;
          iconColor = 'text-amber-600 bg-amber-50';
        }

        return (
          <div key={idx} className="relative group">
            {/* Dot/Icon on line */}
            <div
              className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border border-white shadow-xs flex items-center justify-center ${iconColor}`}
            >
              <Icon className="w-3.5 h-3.5" />
            </div>

            {/* Content */}
            <div className="bg-white p-3 rounded-lg border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-slate-900">{event.event}</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  {formatDateTime(event.time)}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">{event.description}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Source:</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                  {event.source}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
