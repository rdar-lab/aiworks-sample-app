import React, { forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';

interface PdfIconProps {
  size?: number;
  className?: string;
}

const PdfIcon: LucideIcon = forwardRef<SVGSVGElement, PdfIconProps>(
  ({ size = 24, className = '' }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      width={size}
      height={size}
      className={className}
    >
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="12"
        y="17"
        fontSize="6"
        fontWeight="bold"
        fill="currentColor"
        textAnchor="middle"
        stroke="none"
      >
        PDF
      </text>
    </svg>
  )
);

PdfIcon.displayName = 'PdfIcon';

export default PdfIcon;
