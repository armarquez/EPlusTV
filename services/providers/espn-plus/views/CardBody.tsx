import {FC} from 'hono/jsx';

import {TESPNPlusTokens, IEspnPlusMeta} from '@/services/espn-handler';
import {SubscriptionIndicators} from './SubscriptionIndicators';

interface IESPNPlusBodyProps {
  enabled: boolean;
  tokens?: TESPNPlusTokens;
  meta?: IEspnPlusMeta;
  open?: boolean;
}

export const ESPNPlusBody: FC<IESPNPlusBodyProps> = ({enabled, tokens, meta, open}) => {
  const parsedTokens = JSON.stringify(tokens, undefined, 2);

  if (!enabled) {
    return <></>;
  }

  return (
    <div hx-swap="outerHTML" hx-target="this">
      {meta && (
        <details>
          <summary>Entitlements</summary>
          <SubscriptionIndicators meta={meta} />
        </details>
      )}
      <details open={open}>
        <summary>Tokens</summary>
        <div>
          <pre>{parsedTokens}</pre>
          <form hx-put="/providers/espnplus/reauth" hx-trigger="submit">
            <button id="espnplus-reauth">Re-Authenticate</button>
          </form>
        </div>
      </details>
    </div>
  );
};
