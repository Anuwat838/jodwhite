/* JodWhite service worker — network-first strategy
   หมายเหตุ: เมื่อแก้แอปแล้วต้องการบังคับอัปเดต ให้เปลี่ยนเลข cache ด้านล่าง (เช่น jodwhite-v2) */
const CACHE = "jodwhite-v9";
const ASSETS = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./favicon.png"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  // ไม่ cache คำขอไป Firebase / Google APIs
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
  );
});


/* ═══════════════════════════════════════════════════════════════
   แจ้งเตือนแบบ Push (ส่งมาจากเซิร์ฟเวอร์ผ่าน Firebase Cloud Messaging)
   ทำงานแม้ปิดแอปอยู่ และไม่มีค่าใช้จ่าย
   ═══════════════════════════════════════════════════════════════ */
self.addEventListener("push", e => {
  let payload = {};
  try { payload = e.data ? e.data.json() : {}; }
  catch (_) { payload = { notification: { title: "JodWhite", body: e.data ? e.data.text() : "" } }; }

  const n = payload.notification || payload.data || {};
  const title = n.title || "JodWhite";
  const options = {
    body: n.body || "",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: n.tag || "jodwhite",
    renotify: true,
    data: { url: (payload.fcmOptions && payload.fcmOptions.link) ||
                 (payload.fcm_options && payload.fcm_options.link) ||
                 n.link || "./index.html" }
  };
  e.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      // ตั้งตัวเลขแดงบนไอคอน (ถ้าเบราว์เซอร์รองรับ)
      if (self.registration.setAppBadge) self.registration.setAppBadge().catch(() => {});
    })
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  // กดดูแล้ว = ล้างตัวเลขแดงทันที
  if (self.registration.clearAppBadge) self.registration.clearAppBadge().catch(() => {});
  const url = (e.notification.data && e.notification.data.url) || "./index.html";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});

// แอปสั่งล้างตัวเลขแดง (ตอนเปิดแอปหรือกลับมาโฟกัส)
self.addEventListener("message", e => {
  if (e.data && e.data.type === "clearBadge" && self.registration.clearAppBadge) {
    self.registration.clearAppBadge().catch(() => {});
  }
});
