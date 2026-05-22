import { PANEL_FULL, LABEL } from '../../styles/shared';
import CraftTab from './CraftTab';

export default function ForgePanel() {
  return (
    <div style={PANEL_FULL}>
      <div style={LABEL}>제작</div>
      <CraftTab />
    </div>
  );
}
