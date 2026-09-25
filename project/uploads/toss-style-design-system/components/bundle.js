/* @ds-bundle: {"format":4,"namespace":"TossStyle","components":[{"name":"Button"},{"name":"BottomCTA"},{"name":"Top"},{"name":"ListRow"},{"name":"Border"},{"name":"TextField"},{"name":"Switch"},{"name":"Badge"},{"name":"Toast"},{"name":"ConfirmDialog"},{"name":"BottomSheet"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;

  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(' ');
  }

  function omit(obj, keys) {
    var out = {};
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && keys.indexOf(k) < 0) out[k] = obj[k];
    return out;
  }

  function Chevron() {
    return h('svg', { className: 'ts-listrow__arrow', viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': true },
      h('path', { d: 'M7.5 4.5 13 10l-5.5 5.5', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  }

  /* Button: size xlarge|large|medium|small, variant fill|weak, color primary|danger|dark|light, display inline|block|full */
  function Button(props) {
    var size = props.size || 'xlarge';
    var variant = props.variant || 'fill';
    var color = props.color || 'primary';
    var display = props.display || 'inline';
    var rest = omit(props, ['size', 'variant', 'color', 'display', 'loading', 'className', 'children', 'type']);
    return h('button', Object.assign({ type: props.type || 'button' }, rest, {
      className: cx('ts-btn', 'ts-btn--' + size, 'ts-btn--' + variant, 'ts-btn--' + color, 'ts-btn--' + display, props.loading && 'is-loading', props.className),
      disabled: !!(props.disabled || props.loading),
      'aria-busy': props.loading ? true : undefined
    }),
      h('span', { className: 'ts-btn__label' }, props.children),
      props.loading ? h('span', { className: 'ts-btn__dots', 'aria-hidden': true }, h('i'), h('i'), h('i')) : null);
  }

  /* BottomCTA: fixed bottom action area. One child = full width; two = secondary + primary side by side. */
  function BottomCTA(props) {
    return h('div', { className: cx('ts-cta', props.fixed === false && 'ts-cta--static', props.className) },
      h('div', { className: 'ts-cta__fade' }),
      h('div', { className: 'ts-cta__inner' }, props.children));
  }

  /* Top: the big page title block at the start of the content. */
  function Top(props) {
    var Tag = props.as || 'h1';
    return h('header', { className: cx('ts-top', props.size === 'large' && 'ts-top--large', props.className) },
      props.upper ? h('div', { className: 'ts-top__upper' }, props.upper) : null,
      h('div', { className: 'ts-top__content' },
        h('div', { className: 'ts-top__texts' },
          props.subtitleTop ? h('p', { className: 'ts-top__sub-top' }, props.subtitleTop) : null,
          h(Tag, { className: 'ts-top__title' }, props.title),
          props.subtitle ? h('p', { className: 'ts-top__sub' }, props.subtitle) : null),
        props.right || null),
      props.lower ? h('div', { className: 'ts-top__lower' }, props.lower) : null);
  }

  /* ListRow: left (icon/avatar) · title + description · right (value/badge/switch) · optional arrow. */
  function ListRow(props) {
    var interactive = !!props.onClick;
    var rest = omit(props, ['left', 'title', 'description', 'right', 'arrow', 'divider', 'className', 'as']);
    return h(interactive ? 'button' : 'div', Object.assign(interactive ? { type: 'button' } : {}, rest, {
      className: cx('ts-listrow', props.divider && 'ts-listrow--divider', props.className)
    }),
      props.left ? h('span', { className: 'ts-listrow__left' }, props.left) : null,
      h('span', { className: 'ts-listrow__texts' },
        h('span', { className: 'ts-listrow__title' }, props.title),
        props.description ? h('span', { className: 'ts-listrow__desc' }, props.description) : null),
      (props.right || props.arrow) ? h('span', { className: 'ts-listrow__right' }, props.right || null, props.arrow ? h(Chevron) : null) : null);
  }

  function Avatar(props) {
    return h('span', { className: 'ts-avatar', 'aria-hidden': true }, props.children);
  }

  /* Border: full | padding24 (list divider) | height16 (section band) */
  function Border(props) {
    var variant = props.variant || 'full';
    return h('hr', { className: cx('ts-border', 'ts-border--' + variant, props.className), 'aria-hidden': variant === 'height16' ? true : undefined });
  }

  /* TextField: variant box|line|big|hero */
  var fieldSeq = 0;
  function TextField(props) {
    var variant = props.variant || 'line';
    var idRef = React.useRef(null);
    if (idRef.current == null) { fieldSeq += 1; idRef.current = 'ts-field-' + fieldSeq; }
    var id = props.id || idRef.current;
    var st = React.useState(!!props.focused);
    var focused = props.focused != null ? props.focused : st[0];
    var rest = omit(props, ['variant', 'label', 'help', 'hasError', 'suffix', 'focused', 'className', 'id']);
    var input = h('input', Object.assign({}, rest, {
      id: id,
      'aria-invalid': props.hasError ? true : undefined,
      'aria-describedby': props.help ? id + '-help' : undefined,
      onFocus: function (e) { st[1](true); if (props.onFocus) props.onFocus(e); },
      onBlur: function (e) { st[1](false); if (props.onBlur) props.onBlur(e); }
    }));
    var inner = variant === 'box'
      ? h('div', { className: 'ts-field__box' }, input, props.suffix ? h('span', { className: 'ts-field__suffix' }, props.suffix) : null)
      : h('div', { className: 'ts-field__line' }, input, props.suffix ? h('span', { className: 'ts-field__suffix' }, props.suffix) : null);
    return h('div', { className: cx('ts-field', 'ts-field--' + variant, focused && 'is-focused', props.hasError && 'is-error', props.disabled && 'is-disabled', props.className) },
      props.label ? h('label', { className: 'ts-field__label', htmlFor: id }, props.label) : null,
      h('div', { className: 'ts-field__control' }, inner),
      props.help ? h('div', { className: 'ts-field__help', id: id + '-help' }, props.help) : null);
  }

  /* Switch: 50×30 track; the knob grows 16 → 24px when on. */
  function Switch(props) {
    var st = React.useState(!!props.defaultChecked);
    var on = props.checked != null ? props.checked : st[0];
    function toggle() {
      if (props.disabled) return;
      if (props.checked == null) st[1](!on);
      if (props.onChange) props.onChange(!on);
    }
    return h('button', {
      type: 'button', role: 'switch', 'aria-checked': on, 'aria-label': props['aria-label'], disabled: props.disabled,
      className: cx('ts-switch', on && 'is-on', props.className), onClick: toggle
    }, h('span', { className: 'ts-switch__knob' }));
  }

  /* Badge: color blue|teal|green|red|yellow|elephant, variant weak|fill, size xsmall|small|medium|large */
  function Badge(props) {
    return h('span', { className: cx('ts-badge', 'ts-badge--' + (props.color || 'blue'), 'ts-badge--' + (props.variant || 'weak'), 'ts-badge--' + (props.size || 'small'), props.className) }, props.children);
  }

  /* Toast: white pill from the top, auto-closes after `duration` ms (3000). */
  function Toast(props) {
    var duration = props.duration == null ? 3000 : props.duration;
    React.useEffect(function () {
      if (!props.open || !props.onClose || duration === Infinity) return undefined;
      var t = setTimeout(props.onClose, duration);
      return function () { clearTimeout(t); };
    }, [props.open, duration]);
    if (!props.open) return null;
    return h('div', {
      role: 'status', 'aria-live': 'polite',
      className: cx('ts-toast', props.icon && 'ts-toast--icon', props.multiline && 'ts-toast--multi', props.inline && 'ts-toast--static', props.className)
    }, props.icon ? h('span', { className: 'ts-toast__icon', 'aria-hidden': true }, props.icon) : null, props.text);
  }

  /* ConfirmDialog: title + description + [닫기][action]. With no onConfirm it is an alert with one text button. */
  function ConfirmDialog(props) {
    if (!props.open) return null;
    var alert = !props.onConfirm;
    return h(React.Fragment, null,
      h('div', { className: 'ts-dim', onClick: props.onClose, 'aria-hidden': true }),
      h('div', { className: 'ts-dialog', role: alert ? 'alertdialog' : 'dialog', 'aria-modal': true, 'aria-labelledby': 'ts-dialog-title' },
        h('div', { className: 'ts-dialog__body' },
          h('h3', { className: 'ts-dialog__title', id: 'ts-dialog-title' }, props.title),
          props.description ? h('p', { className: 'ts-dialog__desc' }, props.description) : null),
        alert
          ? h('div', { className: 'ts-dialog__alert' }, h('button', { type: 'button', className: 'ts-dialog__text-btn', onClick: props.onClose }, props.closeLabel || '확인'))
          : h('div', { className: 'ts-dialog__actions' },
            h(Button, { size: 'large', variant: 'weak', color: 'dark', display: 'block', onClick: props.onClose }, props.closeLabel || '닫기'),
            h(Button, { size: 'large', variant: 'fill', color: props.danger ? 'danger' : 'primary', display: 'block', onClick: props.onConfirm }, props.confirmLabel || '확인'))));
  }

  /* BottomSheet: floating card 10px from the edges, radius 28, handle 48×4. */
  function BottomSheet(props) {
    if (!props.open) return null;
    return h(React.Fragment, null,
      h('div', { className: 'ts-dim', onClick: props.onClose, 'aria-hidden': true }),
      h('div', { className: 'ts-sheet', role: 'dialog', 'aria-modal': true, 'aria-label': typeof props.title === 'string' ? props.title : undefined },
        h('div', { className: 'ts-sheet__handle', 'aria-hidden': true }),
        props.title ? h('div', { className: 'ts-sheet__header' },
          h('h2', { className: 'ts-sheet__title' }, props.title),
          props.description ? h('p', { className: 'ts-sheet__desc' }, props.description) : null) : null,
        h('div', { className: 'ts-sheet__content' }, props.children),
        props.cta ? h('div', { className: 'ts-sheet__cta' }, props.cta) : null));
  }

  var api = {
    Button: Button, BottomCTA: BottomCTA, Top: Top, ListRow: ListRow, Avatar: Avatar, Border: Border,
    TextField: TextField, Switch: Switch, Badge: Badge, Toast: Toast, ConfirmDialog: ConfirmDialog, BottomSheet: BottomSheet
  };
  window.TossStyle = Object.assign(window.TossStyle || {}, api);
})();
