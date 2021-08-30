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

  const mountSimpleNode = function (vdom, container, oldDomElement, parentComponent) {
    let newDomElement = null;
    const nextSibling = oldDomElement && oldDomElement.nextSibling;

    if (vdom.type === 'text') {
      // handle our custom type for text nodes (see createElement)
      newDomElement = document.createTextNode(vdom.props.textContent);
    } else {
      newDomElement = document.createElement(vdom.type);
    }

    // reference between dom & vdom
    newDomElement._virtualElement = vdom;
    if (nextSibling) {
      container.insertBefore(newDomElement, nextSibling);
    } else {
      container.appendChild(newDomElement);
    }

    // recursively render children
    vdom.children.forEach(child => {
      mountElement(child, newDomElement);
    })
  }

  const mountElement = function (vdom, container, oldDom) {
    return mountSimpleNode(vdom, container, oldDom);
  }

  const render = function (vdom, container, oldDom = container.firstChild) {
    if (!oldDom) {
      mountElement(vdom, container, oldDom)
    }
  }

  return {
    render,
    createElement,
  };
})();
