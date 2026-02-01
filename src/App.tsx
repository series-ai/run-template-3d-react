import { useState } from 'react';
import { TabBar } from './components/TabBar';
import { TAB_CONFIG, DEFAULT_TAB_ID, type TabId } from './tabs/tabConfig';
import './style.css';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>(DEFAULT_TAB_ID);

  const activeTabDefinition = TAB_CONFIG.find((tab) => tab.id === activeTab) ?? TAB_CONFIG[0];
  const tabContent = activeTabDefinition.render();

  return (
    <>
      {/* Landscape Warning */}
      <div className="landscape-warning">
        <div className="landscape-warning-icon">📱</div>
        <h2>Portrait Mode Only</h2>
        <p>Please rotate your device to portrait orientation</p>
      </div>

      {/* Main App */}
      <div className="app-container">
        <div className="content-area">
          <div className="tab-content tab-fade-in" key={activeTab}>
            {tabContent}
          </div>
        </div>

        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </>
  );
}

export default App;
