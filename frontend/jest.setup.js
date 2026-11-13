require('@testing-library/jest-dom');

// Mock para ResizeObserver utilizado pelo React Flow
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock para scrollIntoView
window.HTMLElement.prototype.scrollIntoView = function () {};
