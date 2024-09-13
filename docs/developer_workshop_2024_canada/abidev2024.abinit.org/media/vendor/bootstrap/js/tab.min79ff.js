import{E as EventHandler,j as isDisabled,S as SelectorEngine,d as defineJQueryPlugin,B as BaseComponent,g as getElementFromSelector,b as getNextActiveElement}from"./dom.min.js?5.2.3";const NAME="tab",DATA_KEY="bs.tab",EVENT_KEY=".bs.tab",EVENT_HIDE="hide.bs.tab",EVENT_HIDDEN="hidden.bs.tab",EVENT_SHOW="show.bs.tab",EVENT_SHOWN="shown.bs.tab",EVENT_CLICK_DATA_API="click.bs.tab",EVENT_KEYDOWN="keydown.bs.tab",EVENT_LOAD_DATA_API="load.bs.tab",ARROW_LEFT_KEY="ArrowLeft",ARROW_RIGHT_KEY="ArrowRight",ARROW_UP_KEY="ArrowUp",ARROW_DOWN_KEY="ArrowDown",CLASS_NAME_ACTIVE="active",CLASS_NAME_FADE="fade",CLASS_NAME_SHOW="show",CLASS_DROPDOWN="dropdown",SELECTOR_DROPDOWN_TOGGLE=".dropdown-toggle",SELECTOR_DROPDOWN_MENU=".dropdown-menu",NOT_SELECTOR_DROPDOWN_TOGGLE=":not(.dropdown-toggle)",SELECTOR_TAB_PANEL='.list-group, .nav, [role="tablist"]',SELECTOR_OUTER=".nav-item, .list-group-item",SELECTOR_INNER='.nav-link:not(.dropdown-toggle), .list-group-item:not(.dropdown-toggle), [role="tab"]:not(.dropdown-toggle)',SELECTOR_DATA_TOGGLE='[data-bs-toggle="tab"], [data-bs-toggle="pill"], [data-bs-toggle="list"]',SELECTOR_INNER_ELEM=`${SELECTOR_INNER}, ${SELECTOR_DATA_TOGGLE}`,SELECTOR_DATA_TOGGLE_ACTIVE='.active[data-bs-toggle="tab"], .active[data-bs-toggle="pill"], .active[data-bs-toggle="list"]';class Tab extends BaseComponent{constructor(t){super(t),this._parent=this._element.closest(SELECTOR_TAB_PANEL),this._parent&&(this._setInitialAttributes(this._parent,this._getChildren()),EventHandler.on(this._element,EVENT_KEYDOWN,(t=>this._keydown(t))))}static get NAME(){return NAME}show(){const t=this._element;if(this._elemIsActive(t))return;const e=this._getActiveElem(),s=e?EventHandler.trigger(e,EVENT_HIDE,{relatedTarget:t}):null;EventHandler.trigger(t,EVENT_SHOW,{relatedTarget:e}).defaultPrevented||s&&s.defaultPrevented||(this._deactivate(e,t),this._activate(t,e))}_activate(t,e){if(!t)return;t.classList.add("active"),this._activate(getElementFromSelector(t));this._queueCallback((()=>{"tab"===t.getAttribute("role")?(t.removeAttribute("tabindex"),t.setAttribute("aria-selected",!0),this._toggleDropDown(t,!0),EventHandler.trigger(t,EVENT_SHOWN,{relatedTarget:e})):t.classList.add("show")}),t,t.classList.contains("fade"))}_deactivate(t,e){if(!t)return;t.classList.remove("active"),t.blur(),this._deactivate(getElementFromSelector(t));this._queueCallback((()=>{"tab"===t.getAttribute("role")?(t.setAttribute("aria-selected",!1),t.setAttribute("tabindex","-1"),this._toggleDropDown(t,!1),EventHandler.trigger(t,EVENT_HIDDEN,{relatedTarget:e})):t.classList.remove("show")}),t,t.classList.contains("fade"))}_keydown(t){if(![ARROW_LEFT_KEY,ARROW_RIGHT_KEY,ARROW_UP_KEY,ARROW_DOWN_KEY].includes(t.key))return;t.stopPropagation(),t.preventDefault();const e=[ARROW_RIGHT_KEY,ARROW_DOWN_KEY].includes(t.key),s=getNextActiveElement(this._getChildren().filter((t=>!isDisabled(t))),t.target,e,!0);s&&(s.focus({preventScroll:!0}),Tab.getOrCreateInstance(s).show())}_getChildren(){return SelectorEngine.find(SELECTOR_INNER_ELEM,this._parent)}_getActiveElem(){return this._getChildren().find((t=>this._elemIsActive(t)))||null}_setInitialAttributes(t,e){this._setAttributeIfNotExists(t,"role","tablist");for(const t of e)this._setInitialAttributesOnChild(t)}_setInitialAttributesOnChild(t){t=this._getInnerElement(t);const e=this._elemIsActive(t),s=this._getOuterElement(t);t.setAttribute("aria-selected",e),s!==t&&this._setAttributeIfNotExists(s,"role","presentation"),e||t.setAttribute("tabindex","-1"),this._setAttributeIfNotExists(t,"role","tab"),this._setInitialAttributesOnTargetPanel(t)}_setInitialAttributesOnTargetPanel(t){const e=getElementFromSelector(t);e&&(this._setAttributeIfNotExists(e,"role","tabpanel"),t.id&&this._setAttributeIfNotExists(e,"aria-labelledby",`#${t.id}`))}_toggleDropDown(t,e){const s=this._getOuterElement(t);if(!s.classList.contains("dropdown"))return;const i=(t,i)=>{const a=SelectorEngine.findOne(t,s);a&&a.classList.toggle(i,e)};i(".dropdown-toggle","active"),i(".dropdown-menu","show"),s.setAttribute("aria-expanded",e)}_setAttributeIfNotExists(t,e,s){t.hasAttribute(e)||t.setAttribute(e,s)}_elemIsActive(t){return t.classList.contains("active")}_getInnerElement(t){return t.matches(SELECTOR_INNER_ELEM)?t:SelectorEngine.findOne(SELECTOR_INNER_ELEM,t)}_getOuterElement(t){return t.closest(SELECTOR_OUTER)||t}static jQueryInterface(t){return this.each((function(){const e=Tab.getOrCreateInstance(this);if("string"==typeof t){if(void 0===e[t]||t.startsWith("_")||"constructor"===t)throw new TypeError(`No method named "${t}"`);e[t]()}}))}}if(EventHandler.on(document,"click.bs.tab",SELECTOR_DATA_TOGGLE,(function(t){["A","AREA"].includes(this.tagName)&&t.preventDefault(),isDisabled(this)||Tab.getOrCreateInstance(this).show()})),EventHandler.on(window,"load.bs.tab",(()=>{for(const t of SelectorEngine.find(SELECTOR_DATA_TOGGLE_ACTIVE))Tab.getOrCreateInstance(t)})),defineJQueryPlugin(Tab),window.Joomla=window.Joomla||{},window.bootstrap=window.bootstrap||{},window.bootstrap.Tab=Tab,Joomla.initialiseTabs=(t,e)=>{if(t instanceof Element||!e.isJoomla)Array.from(document.querySelectorAll(`${t} a`)).map((t=>new window.bootstrap.Tab(t,e)));else{const e=document.querySelector(`${t}Content`);if(e){const s=Array.from(e.children);s.length&&s.forEach((e=>{if(!e.classList.contains("tab-pane"))return;const s=""!==e.dataset.active,i=document.querySelector(`${t}Tabs`);if(i){const t=document.createElement("a");t.href=`#${e.dataset.id}`,t.classList.add("nav-link"),s&&t.classList.add("active"),t.dataset.bsToggle="tab",t.setAttribute("role","tab"),t.setAttribute("aria-controls",e.dataset.id),t.setAttribute("aria-selected",e.dataset.id),t.innerHTML=Joomla.sanitizeHtml(e.dataset.title);const a=document.createElement("li");a.classList.add("nav-item"),a.setAttribute("role","presentation"),a.appendChild(t),i.appendChild(a),new window.bootstrap.Tab(a)}}))}}},Joomla&&Joomla.getOptions){const t=Joomla.getOptions("bootstrap.tabs");"object"==typeof t&&null!==t&&Object.keys(t).map((e=>Joomla.initialiseTabs(e,t[e])))}export{Tab as T};