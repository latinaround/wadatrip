export const FORM_ACTIVITY_INTERVAL = 60000;

// No timer, polling, field contents or event history. One bounded request on
// genuine interaction with an editable form; background pages do not renew.
export function createFormActivityReporter(report, {
  now = () => globalThis.performance?.now?.() ?? Date.now(), canReport = () => true, onError = () => {}, onSuccess = () => {},
} = {}) {
  let lastAttempt = -Infinity, pending = false, disposed = false;
  return {
    note(event) {
      const native = event?.nativeEvent || event;
      const field = native?.target?.closest?.('input, textarea, select, [role="combobox"], [role="spinbutton"]');
      const choice = field?.getAttribute?.('role') === 'combobox';
      if (disposed || pending || native?.isTrusted !== true || !field?.closest?.('form')
        || field.disabled || field.readOnly || (!choice && ['password', 'hidden', 'submit', 'button'].includes(field.type))
        || !canReport()) return;
      if (native.type === 'keydown' && (native.ctrlKey || native.metaKey || native.altKey
        || ['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'Escape'].includes(native.key))) return;
      const time = now();
      if (!Number.isFinite(time) || time - lastAttempt < FORM_ACTIVITY_INTERVAL) return;
      lastAttempt = time; pending = true;
      let sent = false;
      Promise.resolve().then(() => {
        if (!disposed && canReport()) { sent = true; return report(); }
      }).then(() => { if (!disposed && sent) onSuccess(); }, error => {
        if (!disposed) onError(error);
      }).finally(() => { pending = false; });
    },
    dispose() { disposed = true; },
  };
}
