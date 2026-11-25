const CART_URLS = {
  naivas: "https://www.naivas.online/cart",
  carrefour: "https://www.carrefour.ke/mafken/en/cart",
  jumia: "https://www.jumia.co.ke/cart/",
  amazon: "https://www.amazon.com/gp/cart/view.html",
  walmart: "https://www.walmart.com/cart",
};

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1800); // Allow dynamic product grids to render
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action !== "PLACE_ORDER" || !Array.isArray(msg.items)) return;

  (async () => {
    const tab = await chrome.tabs.create({
      url: msg.items[0].targetUrl,
      active: true,
    });

    for (let i = 0; i < msg.items.length; i++) {
      const item = msg.items[i];
      if (i > 0) await chrome.tabs.update(tab.id, { url: item.targetUrl });
      await waitForTabLoad(tab.id);

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [item.orderQty],
        func: async (qty) => {
          const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
          const buttons = Array.from(
            document.querySelectorAll("button, a[role='button']"),
          );
          const addBtn = buttons.find((b) =>
            /add to (cart|basket|bag)/i.test(
              b.innerText || b.getAttribute("aria-label") || "",
            ),
          );
          if (addBtn) {
            for (let c = 0; c < qty; c++) {
              addBtn.click();
              await sleep(700);
            }
          }
        },
      });
    }

    const cartUrl = CART_URLS[msg.store];
    if (cartUrl) await chrome.tabs.update(tab.id, { url: cartUrl });
  })();
});
