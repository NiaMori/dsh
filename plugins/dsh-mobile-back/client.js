window.__ModuleLoader__.load({
id: "dsh-mobile-back",
factory: (require) => {
var module = { exports: {} };
var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

var inject = ["layout"];

function apply(ctx) {
ctx.effect(function () {
var mq = window.matchMedia("(max-width: 1023px)");
var marker = { dshMobileBack: true };
var armed = false;

var drawerOpen = function () {
var overlay = document.querySelector("[data-shell-overlay]");
var frame = overlay && overlay.parentElement ? overlay.parentElement : null;
return frame !== null && !frame.hasAttribute("data-sidebar-collapsed");
};

var ensureMarker = function () {
if (armed) return;
try {
history.pushState(marker, "");
armed = true;
} catch (_) {
// Sandboxed or data: documents can reject history.pushState; the
// drawer stays reachable from the header/floating button.
}
};

var onPop = function () {
if (!mq.matches) return;
// A modal/sheet owns the first back press: drop our marker and
// stay out of the way instead of toggling the drawer behind it.
if (document.querySelector("[aria-modal='true']") !== null) {
armed = false;
return;
}
armed = false;
ensureMarker();
ctx.layout.toggleSidebar();
};

var arm = function () {
if (mq.matches) {
ensureMarker();
window.addEventListener("popstate", onPop);
} else {
window.removeEventListener("popstate", onPop);
}
};

arm();
mq.addEventListener("change", arm);
return function () {
mq.removeEventListener("change", arm);
window.removeEventListener("popstate", onPop);
};
}, "dsh-mobile-back: back toggles sidebar");
}

exports.apply = apply;
exports.inject = inject;
return module.exports;
}
});
