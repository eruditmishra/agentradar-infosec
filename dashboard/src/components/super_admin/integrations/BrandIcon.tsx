import React from 'react';
import type { IntegrationProvider } from '../../../types/integration';

interface BrandIconProps {
  providerId: IntegrationProvider | string;
  className?: string;
  size?: number;
}

export const BrandIcon: React.FC<BrandIconProps> = ({
  providerId,
  className = 'w-6 h-6',
  size,
}) => {
  const style = size ? { width: size, height: size } : undefined;

  switch (providerId) {
    case 'azure':
      return (
        <svg viewBox="0 0 96 96" className={className} style={style} fill="none" aria-label="Microsoft Azure">
          <defs>
            <linearGradient id="az-g1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1988D9" />
              <stop offset="100%" stopColor="#0062AD" />
            </linearGradient>
            <linearGradient id="az-g2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#50E6FF" />
              <stop offset="100%" stopColor="#1988D9" />
            </linearGradient>
          </defs>
          <path d="M57.9 6.5a4.7 4.7 0 0 0-4.1 2.4L2.4 83.2A4.7 4.7 0 0 0 6.5 90h26.2a4.7 4.7 0 0 0 4.1-2.4l10.9-17.7 20 17.7a4.7 4.7 0 0 0 3.1 1.2h18.7a4.7 4.7 0 0 0 4.1-6.8L62 8.9a4.7 4.7 0 0 0-4.1-2.4z" fill="#0078D4"/>
          <path d="M70.8 68.8H36.8l17-27.6z" fill="#004E8C" opacity="0.35"/>
          <path d="M57.9 6.5a4.7 4.7 0 0 0-4.1 2.4l-20.9 34 14.8 13.9 14.2-24.3 14.2 24.3h17.4L62 8.9a4.7 4.7 0 0 0-4.1-2.4z" fill="url(#az-g2)"/>
          <path d="M53.8 8.9 2.4 83.2A4.7 4.7 0 0 0 6.5 90h26.2a4.7 4.7 0 0 0 4.1-2.4l15-24.5-14.8-13.9z" fill="url(#az-g1)"/>
          <path d="m32.7 87.6 19.1-31.3 19 31.3a4.7 4.7 0 0 1-4.1 2.4H36.8a4.7 4.7 0 0 1-4.1-2.4z" fill="#0078D4"/>
        </svg>
      );

    case 'aws':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="Amazon Web Services">
          <path
            d="M6.43 8.35c0-.98-.65-1.58-1.78-1.58-1.07 0-1.87.62-2.02 1.48h1.27c.09-.32.35-.55.75-.55.45 0 .7.22.7.67v.48c-.64.08-1.52.2-2.17.49-.91.41-1.39 1.05-1.39 1.93 0 1.25.96 2.01 2.14 2.01 1.05 0 1.63-.44 1.96-1.05h.06v.92h1.2V8.35h-.72zm-.72 2.97c-.22.5-.72.82-1.33.82-.67 0-1.12-.4-1.12-1.03 0-.69.49-1.07 1.34-1.22.41-.07.82-.12 1.11-.18v1.61z"
            fill="#232F3E"
          />
          <path d="M12.98 6.9h-1.27l-1.39 4.96h-.06L8.88 6.9H7.6l1.97 6.16h1.36l2.05-6.16z" fill="#232F3E" />
          <path d="M13.88 6.9l1.45 4.94h.06l1.48-4.94h1.22l-2.09 6.16h-1.32L12.66 6.9h1.22z" fill="#232F3E" />
          <path
            d="M19.14 11.23c.33.22.84.42 1.37.42.61 0 .97-.28.97-.68 0-.41-.29-.62-1.03-.92-.99-.4-1.51-.93-1.51-1.75 0-1.12.93-1.89 2.27-1.89.65 0 1.2.18 1.54.41l-.42.92c-.26-.17-.67-.34-1.14-.34-.64 0-.96.31-.96.64 0 .39.33.58 1.07.89 1.04.44 1.48.97 1.48 1.78 0 1.19-.94 1.96-2.34 1.96-.68 0-1.37-.22-1.73-.48l.43-.96z"
            fill="#232F3E"
          />
          <path
            d="M21.57 16.92c-3.14 2.12-7.51 3.23-11.44 3.23-5.54 0-10.53-2.09-14.3-5.59-.3-.28-.03-.66.34-.45 3.99 2.32 8.92 3.73 14.04 3.73 3.51 0 7.42-.87 10.98-2.67.54-.27.95.34.38.75z"
            fill="#FF9900"
          />
          <path
            d="M22.77 15.52c-.39-.51-2.61-.24-3.62-.12-.31.04-.36-.23-.08-.42 1.83-1.28 4.79-.91 5.13-.49.33.42-.23 3.42-1.96 4.83-.26.22-.52.1-.4-.18.39-.93 1.32-3.11.93-3.62z"
            fill="#FF9900"
          />
        </svg>
      );

    case 'gcp':
      return (
        <svg viewBox="0 0 48 48" className={className} style={style} fill="none" aria-label="Google Cloud Platform">
          <path fill="#4285F4" d="M38.7 20.1C37.4 13.2 31.3 8 24 8c-3 0-5.7.9-8 2.4l4.2 7.3c1.2-.6 2.5-.9 3.8-.9 5 0 9 4 9 9 0 .8-.1 1.6-.3 2.4l6.8 3.9c1.9-2.8 3.2-6.2 3.2-9.9 0-.8-.1-1.5-.2-2.1z"/>
          <path fill="#EA4335" d="M24 8c-5.8 0-10.8 3.3-13.3 8.1 1.6.5 3 1.3 4.3 2.2C16.9 16.9 20.2 16 24 16c1.3 0 2.6.3 3.8.9L24 8z"/>
          <path fill="#FBBC05" d="M10.7 16.1C4.7 16.7 0 21.8 0 28c0 6.6 5.4 12 12 12h3.6v-8H12c-2.2 0-4-1.8-4-4 0-2 1.5-3.7 3.5-4l1.2-.2.4-1.1c1-3.2 4-5.5 7.4-5.5 1.3 0 2.6.3 3.8.9l4.2-7.3c-2.3-1.5-5-2.4-8-2.4-5.8 0-10.8 3.3-13.3 8.1l3.5 2.6z"/>
          <path fill="#34A853" d="M38 28c0-.8-.1-1.6-.3-2.4l-6.8-3.9C30.7 22.5 30 24.1 30 26c0 4.4-3.6 8-8 8h-6.4v8H38c5.5 0 10-4.5 10-10 0-5.3-4.1-9.6-9.3-9.9-.5 1.3-.7 2.6-.7 3.9z"/>
        </svg>
      );

    case 'crowdstrike':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="CrowdStrike Falcon">
          <path
            d="M21.5 5.2c-2.8 1.1-6.2 3.2-8.9 5.8-2.6 2.5-4.8 5.7-5.9 8.8 1.8-1.5 4.1-2.9 6.5-3.8 2.9-1.1 5.9-1.5 8.8-1.4-1.3-1.4-2.8-2.6-4.5-3.5 1.6-.7 3.3-1.1 5-1.2-2.1-1.3-4.5-2.2-7.1-2.6 2.2-.6 4.3-.9 6.1-2.1z"
            fill="#E0161E"
          />
          <path
            d="M12.5 8.2c-3.1 1.6-5.8 4.2-7.7 7.3-1.8 3-2.8 6.4-2.8 6.5 1.5-1.9 3.5-3.5 5.8-4.7 2.4-1.2 5.1-1.9 7.8-2-1.7-1.1-3.6-1.9-5.6-2.4 2.1-.9 4.3-1.4 6.6-1.5-1.4-.9-2.8-1.8-4.1-3.2z"
            fill="#B30E15"
          />
          <path
            d="M23 2c-3.5 1.2-7.3 3.5-10.4 6.7-3.1 3.2-5.4 7.2-6.5 11.3 2.1-2 4.8-3.7 7.7-4.8 3.5-1.3 7.2-1.7 10.7-1.4-1.8-1.6-3.8-3-6-4.1 2.2-.8 4.5-1.2 6.8-1.3-2.7-1.6-5.8-2.7-9-3.2 2.7-.7 5.3-1.1 7.7-2.6-.3-.2-.6-.4-1-.6z"
            fill="#E0161E"
          />
        </svg>
      );

    case 'cortex_xdr':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="Palo Alto Cortex XDR">
          <path d="M12 2.2L3.5 7.1v9.8L12 21.8l8.5-4.9V7.1L12 2.2z" stroke="#FA582D" strokeWidth="1.8" strokeLinejoin="round"/>
          <path d="M12 6.5L6.5 9.7v4.6L12 17.5l5.5-3.2V9.7L12 6.5z" fill="#FA582D" fillOpacity="0.25" stroke="#FA582D" strokeWidth="1.2"/>
          <path d="M9 9l6 6M15 9l-6 6" stroke="#FA582D" strokeWidth="2.2" strokeLinecap="round"/>
          <circle cx="12" cy="12" r="1.8" fill="#FA582D"/>
        </svg>
      );

    case 'sentinelone':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="SentinelOne">
          <path d="M12 2L4 5.5v6.2c0 5.4 3.4 10.4 8 11.8 4.6-1.4 8-6.4 8-11.8V5.5L12 2z" fill="#6F2DE4" fillOpacity="0.16" stroke="#6F2DE4" strokeWidth="1.6"/>
          <path d="M15.8 8.2c-.8-.8-2-1.2-3.8-1.2-2.5 0-4.2 1.3-4.2 3.3 0 1.8 1.3 2.7 3.3 3.1l1.4.3c1.4.3 2.1.8 2.1 1.7 0 1.1-1.1 1.8-2.6 1.8-1.8 0-3-.7-3.6-1.7l-1.6 1.3c1 1.4 2.8 2.4 5.2 2.4 2.8 0 4.7-1.5 4.7-3.7 0-1.9-1.4-2.8-3.5-3.3l-1.3-.3c-1.3-.3-1.9-.7-1.9-1.5 0-.9.9-1.5 2.2-1.5 1.4 0 2.4.5 3 1.3l1.6-1.3z" fill="#6F2DE4"/>
        </svg>
      );

    case 'intune':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="Microsoft Intune">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#0078D4" fillOpacity="0.18"/>
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" stroke="#0078D4" strokeWidth="1.5"/>
          <rect x="7.5" y="10.5" width="9" height="6.5" rx="1" fill="#005A9E"/>
          <rect x="8.5" y="11.5" width="7" height="4.5" rx="0.5" fill="#50E6FF"/>
          <path d="M6 18.5h12" stroke="#0078D4" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      );

    case 'netskope':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="Netskope">
          <circle cx="12" cy="12" r="9.5" stroke="#0088CC" strokeWidth="1.4" strokeDasharray="3 3"/>
          <path d="M12 4a8 8 0 0 1 8 8c0 3.5-2.2 6.5-5.5 7.5" stroke="#0088CC" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M12 7.5a4.5 4.5 0 0 1 4.5 4.5c0 2-1.3 3.7-3.2 4.3" stroke="#00B0FF" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="12" cy="12" r="2.2" fill="#0088CC"/>
        </svg>
      );

    case 'splunk':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="Splunk">
          <path d="M5 6.5l6.5 5.5L5 17.5" stroke="#EA185D" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M13.5 17.5h6" stroke="#65A637" strokeWidth="3.2" strokeLinecap="round"/>
        </svg>
      );

    case 'sentinel':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="Microsoft Sentinel">
          <path d="M12 2L4 5.5v6.2c0 5.4 3.4 10.4 8 11.8 4.6-1.4 8-6.4 8-11.8V5.5L12 2z" fill="#0078D4" fillOpacity="0.16" stroke="#0078D4" strokeWidth="1.6"/>
          <circle cx="12" cy="12" r="4.8" stroke="#00B7C3" strokeWidth="1.8"/>
          <circle cx="12" cy="12" r="1.8" fill="#00B7C3"/>
          <path d="M12 6.8v2.2M12 15v2.2M6.8 12h2.2M15 12h2.2" stroke="#00B7C3" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      );

    case 'okta':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="Okta">
          <circle cx="12" cy="12" r="7.8" stroke="#007DC1" strokeWidth="4.4"/>
        </svg>
      );

    case 'entra':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="Microsoft Entra ID">
          <path d="M12 2.5L4 7l8 4.5L20 7l-8-4.5z" fill="#00A4EF"/>
          <path d="M4 7v10l8 4.5V11.5L4 7z" fill="#0078D4"/>
          <path d="M20 7v10l-8 4.5V11.5L20 7z" fill="#107C41"/>
          <circle cx="12" cy="11.5" r="2.4" fill="#5C2D91"/>
        </svg>
      );

    case 'epic':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="Epic EHR">
          <rect x="2" y="5" width="20" height="14" rx="3" fill="#C8102E"/>
          <text x="12" y="15.2" fill="#FFFFFF" fontSize="9.5" fontWeight="900" fontFamily="system-ui, -apple-system, sans-serif" textAnchor="middle" letterSpacing="-0.5">epic</text>
        </svg>
      );

    case 'cerner':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="Oracle Cerner">
          <rect x="2.5" y="6" width="19" height="12" rx="6" stroke="#F80000" strokeWidth="3" fill="none"/>
          <path d="M12 9v6M9 12h6" stroke="#F80000" strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
      );

    case 'github':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="#24292E" aria-label="GitHub">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
      );

    case 'gitlab':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="GitLab">
          <path fill="#E24329" d="M12 21.42l3.473-10.69H8.527L12 21.42z" />
          <path fill="#FC6D26" d="M12 21.42L8.527 10.73H1.455L12 21.42z" />
          <path fill="#FCA326" d="M1.455 10.73l-.946 2.913a.987.987 0 00.359 1.103L12 21.42 1.455 10.73z" />
          <path fill="#E24329" d="M1.455 10.73h7.072L5.808 2.368a.485.485 0 00-.923 0L1.455 10.73z" />
          <path fill="#FC6D26" d="M12 21.42l3.473-10.69h7.072L12 21.42z" />
          <path fill="#FCA326" d="M22.545 10.73l.946 2.913a.987.987 0 01-.359 1.103L12 21.42l10.545-10.69z" />
          <path fill="#E24329" d="M22.545 10.73h-7.072l2.719-8.362a.485.485 0 01.923 0l3.43 8.362z" />
        </svg>
      );

    case 'jira':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="Jira">
          <path d="M11.53 2c0 2.4-1.97 4.35-4.4 4.35H2.8C2.36 6.35 2 6.71 2 7.15v4.33c0 .44.36.8.8.8h4.33c5.28 0 9.56-4.28 9.56-9.56V2.8c0-.44-.36-.8-.8-.8h-4.36z" fill="#0052CC"/>
          <path d="M21.2 11.72h-4.33c-2.43 0-4.4 1.95-4.4 4.35 0 2.4 1.97 4.35 4.4 4.35h4.33c.44 0 .8-.36.8-.8v-7.1c0-.44-.36-.8-.8-.8z" fill="#2684FF"/>
          <path d="M11.53 11.72c0 2.4-1.97 4.35-4.4 4.35H2.8c-.44 0-.8.36-.8.8v4.33c0 .44.36.8.8.8h4.33c5.28 0 9.56-4.28 9.56-9.56v-.12c0-.44-.36-.8-.8-.8h-4.36z" fill="#2684FF"/>
        </svg>
      );

    case 'jenkins':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="Jenkins">
          <path d="M6 7.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5H6z" fill="#335061"/>
          <path d="M4 8h16c.6 0 1 .4 1 1s-.4 1-1 1H4c-.6 0-1-.4-1-1s.4-1 1-1z" fill="#243844"/>
          <circle cx="12" cy="13.5" r="4.2" fill="#FAD1A8"/>
          <circle cx="10" cy="12.5" r="0.8" fill="#335061"/>
          <circle cx="14" cy="12.5" r="0.8" fill="#335061"/>
          <path d="M9.5 14.5c1 .6 4 .6 5 0-.5 1-2 1.5-2.5 1.5s-2-.5-2.5-1.5z" fill="#335061"/>
          <path d="M9.5 18l5 2.5v-2.5L9.5 20.5v-2.5z" fill="#D33833"/>
          <circle cx="12" cy="19.2" r="1.1" fill="#D33833"/>
          <path d="M6.5 22c0-2.2 2.5-3.8 5.5-3.8s5.5 1.6 5.5 3.8H6.5z" fill="#335061"/>
        </svg>
      );

    case 'salesforce':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="Salesforce Agentforce">
          <path
            d="M18.8 8.8C18.2 6.6 16.2 5 13.8 5c-1.8 0-3.3.9-4.2 2.2C8.9 7.1 8.2 7 7.5 7 5 7 3 9 3 11.5c0 1 .3 2 .9 2.7-.6.7-.9 1.5-.9 2.5 0 2.1 1.7 3.8 3.8 3.8h11.4c2.1 0 3.8-1.7 3.8-3.8 0-1.6-1-2.9-2.4-3.5.7-.9 1.2-2.1 1.2-3.4 0-.4-.1-.7-.2-1z"
            fill="#00A1E0"
          />
          <path d="M14 8.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" fill="#FFFFFF"/>
        </svg>
      );

    case 'claude':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="Anthropic Claude">
          <path
            d="M12 2a1.5 1.5 0 0 1 1.5 1.5v3.1a1 1 0 0 0 1 1h3.1a1.5 1.5 0 0 1 1.5 1.5 1.5 1.5 0 0 1-1.5 1.5h-3.1a1 1 0 0 0-1 1v3.1a1.5 1.5 0 0 1-1.5 1.5 1.5 1.5 0 0 1-1.5-1.5v-3.1a1 1 0 0 0-1-1H6.4A1.5 1.5 0 0 1 4.9 9.1a1.5 1.5 0 0 1 1.5-1.5h3.1a1 1 0 0 0 1-1V3.5A1.5 1.5 0 0 1 12 2z"
            fill="#CC785C"
          />
          <path
            d="M18.36 5.64a1.5 1.5 0 0 1 0 2.12l-2.19 2.19a1 1 0 0 0 0 1.41l2.19 2.19a1.5 1.5 0 1 1-2.12 2.12l-2.19-2.19a1 1 0 0 0-1.41 0l-2.19 2.19a1.5 1.5 0 0 1-2.12-2.12l2.19-2.19a1 1 0 0 0 0-1.41L8.33 7.76a1.5 1.5 0 0 1 2.12-2.12l2.19 2.19a1 1 0 0 0 1.41 0l2.19-2.19a1.5 1.5 0 0 1 2.12 0z"
            fill="#D97757"
          />
        </svg>
      );

    case 'sap':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="SAP">
          <path d="M2.5 5.5h19l-3 13H5.5l-3-13z" fill="#008FD3"/>
          <text x="12" y="15" fill="#FFFFFF" fontSize="7.5" fontWeight="900" fontFamily="system-ui, -apple-system, sans-serif" textAnchor="middle" letterSpacing="0.8">SAP</text>
        </svg>
      );

    case 'zscaler':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="Zscaler">
          <path d="M4 6.5h13.5c2 0 3.2 1.4 3.2 3.2 0 1.2-.6 2.3-1.6 2.9L7.5 18.5h12.5" stroke="#005EB8" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8.5 9.8l-3 3.4" stroke="#009BD9" strokeWidth="2.4" strokeLinecap="round"/>
        </svg>
      );

    case 'palo_alto':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="Palo Alto Networks">
          <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" fill="#FA582D"/>
          <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" fill="#FA582D"/>
          <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" fill="#FA582D"/>
          <rect x="14" y="14" width="6.5" height="6.5" rx="1.5" fill="#FA582D"/>
          <path d="M10 6.75h4M6.75 10v4M17.25 10v4M10 17.25h4" stroke="#FA582D" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );

    case 'slack':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="Slack">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52-2.523c0-1.394 1.127-2.52 2.52-2.52h2.524v2.52c0 1.395-1.13 2.523-2.524 2.523z" fill="#E01E5A"/>
          <path d="M6.313 15.165a2.527 2.527 0 0 1 2.521-2.523 2.528 2.528 0 0 1 2.521 2.523v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/>
          <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52C6.313 1.127 7.44 0 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834z" fill="#36C5F0"/>
          <path d="M8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/>
          <path d="M18.956 8.834c1.394 0 2.522 1.127 2.522 2.521 0 1.395-1.128 2.522-2.522 2.522h-2.522V11.355c0-1.394 1.128-2.521 2.522-2.521z" fill="#2EB67D"/>
          <path d="M17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0c1.394 0 2.523 1.127 2.523 2.522v6.312z" fill="#2EB67D"/>
          <path d="M15.165 18.956c0 1.395-1.129 2.522-2.523 2.522a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52c1.394 0 2.523 1.127 2.523 2.522z" fill="#ECB22E"/>
          <path d="M15.165 17.688a2.527 2.527 0 0 1-2.523-2.523 2.528 2.528 0 0 1 2.523-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#ECB22E"/>
        </svg>
      );

    case 'teams':
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-label="Microsoft Teams">
          <circle cx="16.5" cy="7.5" r="2.5" fill="#6264A7"/>
          <path d="M13 14.5c0-2 1.6-3.5 3.5-3.5S20 12.5 20 14.5V16h-7v-1.5z" fill="#6264A7"/>
          <rect x="3" y="6" width="11" height="12" rx="2" fill="#5059C9"/>
          <text x="8.5" y="15.2" fill="#FFFFFF" fontSize="9.5" fontWeight="bold" fontFamily="system-ui, -apple-system, sans-serif" textAnchor="middle">T</text>
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 8v8M8 12h8"/>
        </svg>
      );
  }
};

export default BrandIcon;
