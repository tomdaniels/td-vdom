const vdom = (() => {
  // the 'sugar syntax' - JSX support..
  function createElement(type, attributes = {}, ...children) {
    const childElements = [].concat(...children).reduce((acc, child) => {
      // this condition handles true/false "boolean short circuiting"
      if (child != null && child !== true && child !== false) {
        if (child instanceof Object) {
          acc.push(child);
        } else {
          // custom text type
          // catch any strings in the mark up and create a text element
          acc.push(
            createElement("text", {
              textContent: child,
            })
          );
        }
      }
      return acc;
    }, []);

    return {
      type,
      children: childElements,
      props: Object.assign({ children: childElements }, attributes),
    };
  }

  function jsToCss(s) {
    // replace borderBottom with border-bottom for example
    return s.replace(/([A-Z])/, "-$1").toLowerCase();
  }

  function styleObjectToCss(styleObj) {
    let styleCss = "",
      sep = ":",
      term = ";";
    // not checking for non-dimensional props here..
    // lets assume the correct dimensional values are passed i.e 10px

    for (let prop in styleObj) {
      if (styleObj.hasOwnProperty(prop)) {
        let val = styleObj[prop];
        styleCss += `${jsToCss(prop)} : ${val} ${term}`; // style property (i.e border-botom)
      }
    }

    return styleCss;
  }

  // create the markup, set attributes & events
  const updateDomElement = function (
    domElement,
    newVirtualElement,
    oldVirtualElement = {}
  ) {
    const oldProps = oldVirtualElement.props || {};
    const newProps = newVirtualElement.props || {};

    // update new props
    Object.keys(newProps).forEach((propName) => {
      const oldProp = oldProps[propName];
      const newProp = newProps[propName];
      if (newProp !== oldProp) {
        if (propName.slice(0, 2) === "on") {
          //prop is an event handler
          const eventName = propName.toLowerCase().slice(2);
          domElement.addEventListener(eventName, newProp, false);
          if (oldProp) {
            domElement.removeEventListener(eventName, oldProp, false);
          }
        } else if (propName === "value" || propName === "checked") {
          // special attributes that cannot be set via setAttribute()
          domElement[propName] = newProp;
        } else if (propName !== "children") {
          // we can ignore the 'children' prop here
          // `mountSimpleNode()` handles children recursively
          if (propName === "className") {
            domElement.setAttribute("class", newProps[propName]);
          } else if (propName === "style" && !newProps[propName].substring) {
            let styleText = styleObjectToCss(newProps[propName]);
            domElement.style = styleText;
          } else {
            domElement.setAttribute(propName, newProps[propName]);
          }
        }
      }
    });

    //remove oldProps
    Object.keys(oldProps).forEach((propName) => {
      const oldProp = oldProps[propName];
      const newProp = newProps[propName];
      if (!newProp) {
        if (propName.slice(0, 2) === "on") {
          domElement.removeEventListener(propName, oldProp, false);
        } else if (propName !== "children") {
          // we know we can ignore children thanks to recursion
          domElement.removeEventListener(propName);
        }
      }
    });
  };

  const mountSimpleNode = function (
    vdom,
    container,
    oldDomElement,
    parentComponent
  ) {
    let newDomElement = null;
    const nextSibling = oldDomElement && oldDomElement.nextSibling;

    if (vdom.type === "text") {
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
    vdom.children.forEach((child) => {
      mountElement(child, newDomElement);
    });

    // ref support
    if (vdom.props && vdom.props.ref) {
      vdom.props.ref(newDomElement);
    }
  };

  function isFunction(obj) {
    return obj && "function" === typeof obj.type;
  }

  function isFunctionalComponent(vnode) {
    let nodeType = vnode && vnode.type;
    return (
      nodeType &&
      isFunction(vnode) &&
      !(nodeType.prototype && nodeType.prototype.render)
    );
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
    let nextvdom = null,
      component = null,
      newDomElement = null;
    if (isFunctionalComponent(vdom)) {
      nextvdom = buildFunctionalComponent(vdom);
    } else {
      nextvdom = buildStatefulComponent(vdom);
      component = nextvdom.component;
    }

    // Recursively render child components
    if (isFunction(nextvdom)) {
      return mountComponent(nextvdom, container, oldDomElement);
    } else {
      newDomElement = mountElement(nextvdom, container, oldDomElement);
    }

    if (component) {
      // lifecycle method
      component.componentDidMount();
      if (component.props.ref) {
        component.props.ref(component);
      }
    }

    return newDomElement;
  }

  const mountElement = function (vdom, container, oldDom) {
    if (isFunction(vdom)) {
      // TODO: this will also handle stateful components.. maybe hooks?
      return mountComponent(vdom, container, oldDom);
    }
    return mountSimpleNode(vdom, container, oldDom);
  };

  const render = function (vdom, container, oldDom = container.firstChild) {
    diff(vdom, container, oldDom);
  };

  // ---------------------------------------------------------------------------------------------
  // diffing

  // remove extra nodes
  function unmount(domElement) {
    const virtualElement = domElement._virtualElement;

    if (!virtualElement) {
      // skip expensive cleanup for simple nodes
      domElement.remove();
      return;
    }

    // component cleanups
    let oldComponent = domElement._virtualElement.component;
    if (oldComponent) {
      // invoke lifecycle
      oldComponent.componentWillUnmount();
    }

    // recursively unmount children
    while (domElement.childNodes.length > 0) {
      unmount(domElement.firstChild);
    }

    // cleanup ref
    if (virtualElement.props && virtualElement.props.ref) {
      virtualElement.props.ref(null);
    }

    // clear out event handlers
    Object.keys(virtualElement.props).forEach((propName) => {
      if (propName.slice(0, 2) === "on") {
        const event = propName.toLowerCase().slice(2);
        const handler = virtualElement.props[propName];
        domElement.removeEventListener(event, handler);
      }
    });

    domElement.remove();
  }

  // helper method -
  function updateTextNode(domElement, newVirtualElement, oldVirtualElement) {
    if (
      newVirtualElement.props.textContent !==
      oldVirtualElement.props.textContent
    ) {
      domElement.textContent = newVirtualElement.props.textContent;
    }
    // set a reference to the newdom
    domElement._virtualElement = newVirtualElement;
  }

  function updateComponent(
    newVirtualElement,
    oldComponent,
    container,
    domElement
  ) {
    // lifecycle method
    oldComponent.componentWillReceiveProps(newVirtualElement.props);

    // lifecycle method
    if (oldComponent.shouldComponentUpdate(newVirtualElement.props)) {
      const prevProps = oldComponent.props;

      // invoke lifecycle
      oldComponent.componentWillUpdate(
        newVirtualElement.props,
        oldComponent.state
      );

      // update component
      oldComponent.updateProps(newVirtualElement.props);

      // call render (generate new vdom)
      const nextElement = oldComponent.render();
      nextElement.component = oldComponent;

      // recursively diff again
      diff(nextElement, container, domElement, oldComponent);

      // invoke lifecycle
      oldComponent.componentDidUpdate(prevProps);
    }
  }

  function isSameComponentType(oldComponent, newVirtualElement) {
    return oldComponent && newVirtualElement.type === oldComponent.constructor;
  }

  function diffComponent(
    newVirtualElement,
    oldComponent,
    container,
    domElement
  ) {
    if (isSameComponentType(oldComponent, newVirtualElement)) {
      updateComponent(newVirtualElement, oldComponent, container, domElement);
    } else {
      mountElement(newVirtualElement, container, domElement);
    }
  }

  // helper func
  function createDomElement(vdom) {
    let newDomElement = null;
    if (vdom.type === "text") {
      newDomElement = document.createTextNode(vdom.props.textContent); // created by createElement
    } else {
      newDomElement = document.createElement(vdom.type);
      updateDomElement(newDomElement, vdom);
    }

    // always set a reference to vdom!
    newDomElement._virtrualElement = vdom;

    // recusively handle children
    vdom.children.forEach((child) => {
      newDomElement.appendChild(createDomElement(child));
    });

    // set refs
    if (vdom.props && vdom.props.ref) {
      vdom.props.ref(newDomElement);
    }

    return newDomElement;
  }

  // diffing algo
  const diff = function (vdom, container, oldDom) {
    let oldVdom = oldDom && oldDom._virtualElement;
    let oldComponent = oldVdom && oldVdom.component;

    if (!oldDom) {
      // initial render
      mountElement(vdom, container, oldDom);
    } else if (vdom.type !== oldVdom.type && typeof vdom.type !== "function") {
      let newDomElement = createDomElement(vdom, oldDom);
      oldDom.parentNode.replaceChild(newDomElement, oldDom);
    } else if (typeof vdom.type === "function") {
      diffComponent(vdom, oldComponent, container, oldDom);
    } else if (oldVdom && oldVdom.type === vdom.type) {
      // handle custom text type
      if (oldVdom.type === "text") {
        updateTextNode(oldDom, vdom, oldVdom);
      } else {
        updateDomElement(oldDom, vdom, oldVdom);
      }
      // set a reference back to updated vdom
      oldDom._virtualElement = vdom;

      // collection of keyed elements
      let keyedElements = {};
      // oldDom.childNodes.map(({ childNodes }) => {...});
      for (let i = 0; i < oldDom.childNodes.length; i += 1) {
        const domElement = oldDom.childNodes[i];
        const key = domElement._virtualElement.props.key;

        if (key) {
          keyedElements[key] = {
            domElement,
            index: i,
          };
        }
      }

      // recursively diff children - 'index diffing'
      if (Object.keys(keyedElements).length === 0) {
        vdom.children.forEach((child, index) => {
          diff(child, oldDom, oldDom.childNodes[index]);
        });
      } else {
        vdom.children.forEach((virtualElement, index) => {
          const key = virtualElement.props.key;

          if (key) {
            const keyedDomElement = keyedElements[key];
            if (keyedDomElement) {
              // position new element based on key/index
              if (
                oldDom.childNodes[index] &&
                !oldDom.childNodes[index].isSameNode(keyedDomElement.domElement)
              ) {
                oldDom.insertBefore(
                  keyedDomElement.domElement,
                  oldDom.childNodes[index]
                );
              }
              diff(virtualElement, oldDom, keyedDomElement.domElement);
            } else {
              mountElement(virtualElement, oldDom);
            }
          }
        });
      }

      // remove old/dead nodes
      let oldNodes = oldDom.childNodes;
      if (Object.keys(keyedElements).length === 0) {
        if (oldNodes.length > vdom.children.length) {
          // es6 support...
          // oldNodes.filter((_, index) => unmount(oldNodes[index]))
          for (let i = oldNodes.length - 1; i >= vdom.children.length; i -= 1) {
            let nodeToBeRemoved = oldNodes[i];
            unmount(nodeToBeRemoved, oldDom);
          }
        }
      } else {
        // oldNodes.map((node) => console.log('mynodes', node));
        if (oldNodes.length > vdom.children.length) {
          for (let i = 0; i < oldDom.childNodes.length; i += 1) {
            let oldChild = oldDom.childNodes[i];
            let oldKey = oldChild.getAttribute("key");

            let found = false;
            for (let n = 0; n < vdom.children.length; n += 1) {
              // look for keyed elements in the vdom
              if (vdom.children[n].props.key == oldKey) {
                found = true;
                break;
              }
            }

            if (!found) {
              unmount(oldChild, oldDom);
            }
          }
        }
      }
    }
  };

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

    updateProps(props) {
      this.props = props;
    }

    // boilerplate lifecycle methods, consumers will customise logic
    componentDidMount() {}
    componentWillReceiveProps(next) {}

    shouldComponentUpdate(nextProps, nextState) {
      return nextProps != this.props || nextState != this.state;
    }

    componentWillUpdate(nextProps, nextState) {}
    componentDidUpdate(prevProps, prevState) {}
    componentWillUnmount() {}
  }

  return {
    render,
    Component,
    createElement,
  };
})();
