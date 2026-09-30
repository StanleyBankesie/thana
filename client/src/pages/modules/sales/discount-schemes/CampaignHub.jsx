/**
 * @fileoverview CampaignHub component.
 * Provides functionality for CampaignHub.
 */

import React from "react";
import { Link } from "react-router-dom";
import "./DiscountSchemeList.css";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function CampaignHub() {
  return (
    <div className="promo-campaign-container">
      <header className="bg-slate-50">
        <div className="ds-header-top">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">
              🎯 Promotional Campaigns
            </h1>
            <p>Choose a campaign type to manage</p>
          </div>
          <div className="ds-header-actions">
            <Link to="/sales?section=Pricing%20%26%20Discounts" className="ds-btn ds-btn-secondary">
              Return to Menu
            </Link>
          </div>
        </div>
      </header>

      <div className="campaign-hub-grid">
        <Link
          to="/sales/discount-schemes/discount"
          className="campaign-hub-card"
        >
          <div className="campaign-hub-icon"></div>
          <h2>Discount Campaign</h2>
          <p>
            Create percentage-based or fixed-amount discount campaigns. Set
            discount values, validity periods, and link items to offer targeted
            price reductions.
          </p>
          <span className="campaign-hub-btn">Manage Discount Campaigns →</span>
        </Link>

        <Link
          to="/sales/discount-schemes/purchase-reward"
          className="campaign-hub-card campaign-hub-card-purchase-reward"
        >
          <div className="campaign-hub-icon"></div>
          <h2>Purchase Reward Campaign</h2>
          <p>
            Reward scheme: buy a specific quantity of an item and get the same
            or another item free. Define purchase items, reward items, required
            quantity, and campaign limits that auto-expire when exhausted.
          </p>
          <span className="campaign-hub-btn">
            Manage Purchase Reward Campaigns →
          </span>
        </Link>
      </div>
    </div>
  );
}
