/**
 * THIS FILE DOES NOT RUN AS PART OF THIS REPO.
 *
 * It's Velo code meant to be pasted into your WIX SITE's own code editor,
 * not deployed by this app. Wix backend event handlers must live in a file
 * named exactly `events.js` inside the site's `Backend` folder in the Wix
 * Editor (Dev Mode / Velo).
 *
 * Purpose: whenever an invoice is created, sent, paid, or becomes overdue
 * in Wix Invoices, forward the invoice data to this app's backend so it
 * shows up automatically in the webapp. Wix Invoices has no public REST
 * API, so this push-based approach (rather than polling) is the only way
 * to observe invoice changes from outside Wix.
 *
 * Setup:
 *   1. In the Wix Editor, turn on Dev Mode (Velo).
 *   2. In the sidebar, under Backend, create (or open) `events.js`.
 *   3. Paste this whole file in, replacing SHARED_SECRET and BACKEND_URL
 *      below:
 *        - SHARED_SECRET: a long random string. Use the SAME value for
 *          WIX_BRIDGE_SECRET in this app's Render environment variables.
 *        - BACKEND_URL: this app's live API URL, e.g.
 *          https://waffle-media-api.onrender.com (no trailing slash) -
 *          check the Render dashboard for the exact URL of the
 *          waffle-media-api service.
 *   4. Publish the site.
 *
 * NOT TESTED against a real Wix site - the onInvoiceCreated/onInvoiceSent/
 * onInvoicePaid/onInvoiceOverdue event names and the Invoice event object
 * shape follow Wix's documented wix-billing-backend events exactly as shown
 * in their reference examples, but this whole file needs a real invoice
 * created in Wix to confirm it works end to end. Check the Wix site's Velo
 * backend logs (Editor -> Dev Mode -> Logs) if an invoice doesn't show up
 * in the webapp, and check the Render service logs on the backend side too
 * (look for lines starting with "[wix]").
 */
import { fetch } from 'wix-fetch';

const SHARED_SECRET = 'REPLACE_WITH_A_LONG_RANDOM_SECRET';
const BACKEND_URL = 'https://REPLACE_WITH_YOUR_RENDER_BACKEND_URL';

async function forward(event) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/wix/invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret: SHARED_SECRET, invoice: event }),
        });
        if (res.status !== 200) {
            console.error('waffle invoice sync failed', res.status, await res.text());
        }
    } catch (err) {
        console.error('waffle invoice sync failed', err);
    }
}

export function wixBilling_onInvoiceCreated(event) {
    return forward(event);
}

export function wixBilling_onInvoiceSent(event) {
    return forward(event);
}

export function wixBilling_onInvoicePaid(event) {
    return forward(event);
}

export function wixBilling_onInvoiceOverdue(event) {
    return forward(event);
}
