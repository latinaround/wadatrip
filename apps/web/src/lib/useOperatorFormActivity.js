import { useCallback, useEffect, useRef, useState } from 'react';
import { webSession } from './web-request';
import { createFormActivityReporter } from './form-activity';

export function useOperatorFormActivity(userId, sessionKey, enabled) {
  const reporter = useRef(null);
  const [activityError, setActivityError] = useState(null);
  useEffect(() => {
    setActivityError(null);
    if (!enabled || !userId || !sessionKey) return;
    const current = createFormActivityReporter(() => webSession.activity(), {
      canReport: () => document.visibilityState === 'visible' && document.hasFocus()
        && webSession.snapshot()?.user?.id === userId && webSession.snapshot()?.session_version === sessionKey,
      onError: () => setActivityError('We could not verify your editing session. Your text is still available in this tab.'),
      onSuccess: () => setActivityError(null),
    });
    reporter.current = current;
    return () => { current.dispose(); if (reporter.current === current) reporter.current = null; };
  }, [userId, sessionKey, enabled]);
  const noteFormActivity = useCallback(event => reporter.current?.note(event), []);
  return { noteFormActivity, activityError };
}
