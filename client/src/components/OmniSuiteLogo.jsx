/**
 * @fileoverview Reusable OmniSuite logo component.
 * Displays the square version of the OmniSuite logo at a configurable size.
 */

import React from 'react';
import logoSquare from '../assets/resources/OMNISUITE_LOGO_SQUARE.png';

/**
 * OmniSuiteLogo component
 * 
 * @param {Object} props
 * @param {number|string} [props.size=36] - The width and height of the logo image.
 * @returns {JSX.Element} The rendered logo image.
 */
export default function OmniSuiteLogo({ size = 36 }) {
  return (
    <img
      src={logoSquare}
      alt="OmniSuite"
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}
