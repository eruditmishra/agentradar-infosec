import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { auditAPI } from '../lib/api';

/**
 * Custom hook to track global frontend telemetry (page views and clicks).
 * It listens to route changes and document clicks, and flushes them to the backend API.
 */
export default function useTelemetry() {
  const location = useLocation();

  // Track Page Views
  useEffect(() => {
    try {
      auditAPI.sendTelemetryEvent({
        type: 'pageview',
        path: location.pathname + location.search,
        timestamp: new Date().toISOString(),
        metadata: {
          referrer: document.referrer || null,
        },
      });
    } catch (err) {
      console.error('Failed to log pageview telemetry:', err);
    }
  }, [location.pathname, location.search]);

  // Track All Clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      try {
        const target = e.target as HTMLElement;
        if (!target) return;

        const metadata = {
          tag: target.tagName.toLowerCase(),
          id: target.id || undefined,
          className: target.className || undefined,
          text: target.textContent?.slice(0, 100).trim() || undefined,
          href: (target as HTMLAnchorElement).href || undefined,
          x: e.clientX,
          y: e.clientY,
        };

        // Construct a logical path to describe the element
        let path = metadata.tag;
        if (metadata.id) path += `#${metadata.id}`;
        else if (metadata.text) path += `[text="${metadata.text.slice(0, 20)}"]`;
        else if (metadata.className && typeof metadata.className === 'string') {
          // just grab the first class for brevity if no text/id
          path += `.${metadata.className.split(' ')[0]}`;
        }

        auditAPI.sendTelemetryEvent({
          type: 'click',
          path: path,
          timestamp: new Date().toISOString(),
          metadata,
        });
      } catch (err) {
        console.error('Failed to log click telemetry:', err);
      }
    };

    // Use capture phase to ensure we catch it before any stopPropagation
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, []);
}
