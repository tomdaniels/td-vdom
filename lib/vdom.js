// welcome, grabba cuppa...
// stay a while, enjoy the read..

// createElementStub

const vdom = (() => {
  function createElement(type, attributes = {}, ...children) {
    const childElements = [].concat(...children).reduce(
      (acc, child) => {
          // this condition handles true/false "boolean short circuiting"
          if (child != null && child !== true && child !== false) {
            if (child instanceof Object) {
              acc.push(child);
            } else {
              // wrap nested text elements
              acc.push(createElement('text', {
                textContent: child,
              }));
            }
          }
          return acc;
      },
    []);

    return {
      type,
      children: childElements,
      props: Object.assign({ chidlren: childElements }, attributes),
    };
  }

  return {
    createElement,
  };
})();
