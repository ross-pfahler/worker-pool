/**
 * Simple wrapper for request animation frame or fallback.
 * @type {function}
 */
var raf = (function () {
  if ('requestAnimationFrame' in window) {
  	return window.requestAnimationFrame.bind(window);
  }
  return function (callback) {
    window.setTimeout(callback, 1000 / 60);
  };
})();

module.exports = {
  raf: raf
};
