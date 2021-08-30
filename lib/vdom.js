// welcome, grabba cuppa...
// stay a while, enjoy the read..

// createElementStub

const vdom = (() => {
  // the 'sugar syntax' - JSX support..
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
      props: Object.assign({ children: childElements }, attributes),
    };
  }

  const updateDomElement = function (domElement, newVirtualElement, oldVirtualElement = {}) {
    // sets DOM attributes and events
    const oldProps = oldVirtualElement.props || {};
    const newProps = newVirtualElement.props || {};

    // update new props
    Object.keys(newProps).forEach(propName => {
      const oldProp = oldProps[propName];
      const newProp = newProps[propName];
      if (newProp !== oldProp) {
        if (propName.slice(0, 2) === 'on') {
          //prop is an event handler
          const eventName = propName.toLowerCase().slice(2);
          domElement.addEventListener(eventName, newProp, false);
          if (oldProp) {
            domElement.removeEventListener(eventName, oldProp, false);
          }
        } else if (propName === 'value' || propName === 'checked') {
          // special attributes that cannot be set via setAttribute()
          domElement[propName] = newProp;
        } else if (propName !== 'children') {
          // we can ignore the 'children' prop here
          // `mountSimpleNode()` handles children recursively
          if (propName === 'className') {
            domElement.setAttribute('class', newProps[propName]);
          } else {
            domElement.setAttribute(propName, newProps[propName]);
          }
        }
      }
    });

    //remove oldProps
    Object.keys(oldProps).forEach(propName => {
      const oldProp = oldProps[propName];
      const newProp = newProps[propName];
      if (!newProp) {
        if (propName.slice(0, 2) === 'on') {
          domElement.removeEventListener(propName, oldProp, false);
        } else if (propName !== 'children') {
          // we know we can ignore children thanks to recursion
          domElement.removeEventListener(propName);
        }
      }
    });
  }

  const mountSimpleNode = function (vdom, container, oldDomElement, parentComponent) {
    let newDomElement = null;
    const nextSibling = oldDomElement && oldDomElement.nextSibling;

    if (vdom.type === 'text') {
      // handle our custom type for text nodes (see createElement)
      newDomElement = document.createTextNode(vdom.props.textContent);
    } else {
      newDomElement = document.createElement(vdom.type);
      updateDomElement(newDomElement, vdom);
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
    });
  }

  const mountElement = function (vdom, container, oldDom) {
    // TODO: function & stateful components.. hooks?
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
