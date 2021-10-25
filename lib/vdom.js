// welcome, grabba cuppa...
// stay a while, enjoy the read..

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
              // custom text type
              // catch any strings in the mark up and create a text element
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

  // create the markup, set attributes & events
  const updateDomElement = function (domElement, newVirtualElement, oldVirtualElement = {}) {
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

    if (oldDomElement) {
      // remove dead nodes
      unmount(oldDomElement, parentComponent);
    }

    if (nextSibling) {
      container.insertBefore(newDomElement, nextSibling);
    } else {
      container.appendChild(newDomElement);
    }

    let component = vdom.component;
    if (component) {
      component.setDomElement(newDomElement);
    }

    // recursively render children
    vdom.children.forEach(child => {
      mountElement(child, newDomElement);
    });
  }

  function isFunction(obj) {
    return obj && 'function' === typeof obj.type;
  }

  function isFunctionalComponent(vnode) {
    let nodeType = vnode && vnode.type;
    return nodeType && isFunction(vnode)
      && !(nodeType.prototype && nodeType.prototype.render);
  }

  function buildFunctionalComponent(vnode, context) {
    return vnode.type(vnode.props || {});
  }

  function buildStatefulComponent(virtualElement) {
    // type here is the constructor function
    const component = new virtualElement.type(virtualElement.props);
    const nextElement = component.render();

    // set reference for diff comparisons
    nextElement.component = component;
    return nextElement;
  }

  function mountComponent(vdom, container, oldDomElement) {
    let nextvdom = null, component = null, newDomElement = null;
    if (isFunctionalComponent(vdom)) {
        nextvdom = buildFunctionalComponent(vdom);
    } else {
      nextvdom = buildStatefulComponent(vdom);
    }

    // Recursively render child components
    if (isFunction(nextvdom)) {
        return mountComponent(nextvdom, container, oldDomElement);
    } else {
        newDomElement = mountElement(nextvdom, container, oldDomElement);
    }
    return newDomElement;
  }

  const mountElement = function (vdom, container, oldDom) {
    if (isFunction(vdom)) {
      // TODO: this will also handle stateful components.. maybe hooks?
      return mountComponent(vdom, container, oldDom);
    }
    return mountSimpleNode(vdom, container, oldDom);
  }

  const render = function (vdom, container, oldDom = container.firstChild) {
    diff(vdom, container, oldDom);
  }

  // ---------------------------------------------------------------------------------------------
  // diffing

  // remove extra nodes
  function unmount(domElement) {
    domElement.remove();
  }

  // helper method - 
  function updateTextNode(domElement, newVirtualElement, oldVirtualElement) {
    if (newVirtualElement.props.textContent !== oldVirtualElement.props.textContent) {
      domElement.textContent = newVirtualElement.props.textContent;
    }
    // set a reference to the newdom
    domElement._virtualElement = newVirtualElement;
  }

  function diffComponent(newVirtualDom, oldComponent, container, domElement) {
    if (!oldComponent) {
      mountElement(newVirtualDom, container, domElement);
    }
  }

  // diffing algo
  const diff = function (vdom, container, oldDom) {
    let oldVdom = oldDom && oldDom._virtualElement;

    if (!oldDom) {
      // initial render
      mountElement(vdom, container, oldDom);
    } else if (typeof vdom.type === 'function') {
        diffComponent(vdom, null, container, oldDom);
    } else if (oldVdom && oldVdom.type === vdom.type) {
      // handle custom text type
      if (oldVdom.type === 'text') {
        updateTextNode(oldDom, vdom, oldVdom)
      } else {
        updateDomElement(oldDom, vdom, oldVdom)
      }
      // set a reference back to updated vdom
      oldDom._virtualElement = vdom;

      // recursively diff children - 'index diffing'
      // TODO: diff by key attribute
      vdom.children.forEach((child, index) => {
        diff(child, oldDom, oldDom.childNodes[index]);
      });

      // remove old/dead nodes
      let oldNodes = oldDom.childNodes;
      if (oldNodes.length > vdom.children.length) {
        // es6 support...
        // oldNodes.filter((_, index) => unmount(oldNodes[index]))
        for (let i = oldNodes.length - 1; i >= vdom.children.length; i -= 1) {
          let nodeToBeRemoved = oldNodes[i];
          unmount(nodeToBeRemoved, oldDom);
        }
      }
    }
  }

  class Component {
    constructor(props) {
      this.props = props;
      this.state = {};
      this.prevState = {};
    }

    setState(next) {
      if (!this.prevState) {
        this.prevState = this.state;
      }

      // no mutations
      this.state = Object.assign({}, next);

      let dom = this.getDomElement();
      let container = dom.parentNode;

      let newvdom = this.render();
      
      // recusively diff
      diff(newvdom, container, dom);
    }

    setDomElement(dom) {
      this._dom = dom;
    }

    getDomElement() {
      return this._dom;
    }
  }

  return {
    render,
    Component,
    createElement,
  };
})();
