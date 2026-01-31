# Privacy Policy

This extension only stores the user data required locally in order to function.
This includes but is not limited to:

- Background color, gradient, image configuration
- Welcome text
- Clock configuration
- Color theme choice

## Online Data Requests

### Google FavIcon

In order to get the web icon of shortcuts, a request is made to Google servers
to the URL `https://www.google.com/s2/favicons?sz=32&domain=${domain}` where
`${domain}` is the shortcut URL that you've set. This is done for each shortcut
in order to display favicons on the start page.

### Helium Bangs

When the "Enable Helium Bangs" option is turned on in search settings, the
extension fetches bang definitions (e.g., `!g` for Google, `!w` for Wikipedia)
from `https://services.helium.imput.net/bangs.json`. This feature is disabled
by default and no request is made unless you explicitly enable it.

This is a read-only request that:

- Fetches a public JSON file containing search engine shortcuts
- Does not send any user data, browsing history, or personal information
- Is cached locally for one week to minimize network requests

No data is transmitted to this service beyond the standard HTTP request headers
sent by your browser.
