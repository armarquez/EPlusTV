import {FC} from 'hono/jsx';
import {IEspnPlusMeta} from '@/services/espn-handler';

interface SubscriptionIndicatorsProps {
  meta: IEspnPlusMeta;
}

export const SubscriptionIndicators: FC<SubscriptionIndicatorsProps> = ({meta}) => (
  <div id="espn-subscription-indicators">
    <div class="grid-container">
      <div />
      <div style="text-align: right;">
        <span>ESPN+:&nbsp;</span>
        <span style={`color: ${meta.espn_plus_subscription ? '#28a745' : '#dc3545'}`}>
          {meta.espn_plus_subscription ? '✓ Detected' : '○ Not detected'}
        </span>
        {meta.espn_plus_subscription && (
          <small class="muted" style="display: block; margin-top: 4px;">
            Auto-detected based on account entitlements
          </small>
        )}
      </div>
    </div>
    <div class="grid-container">
      <div />
      <div style="text-align: right;">
        <span>ESPN Ultimate:&nbsp;</span>
        <span style={`color: ${meta.ultimate_subscription ? '#28a745' : '#dc3545'}`}>
          {meta.ultimate_subscription ? '✓ Detected' : '○ Not detected'}
        </span>
        {meta.ultimate_subscription && (
          <small class="muted" style="display: block; margin-top: 4px;">
            Auto-detected based on account entitlements
          </small>
        )}
      </div>
    </div>
  </div>
);
