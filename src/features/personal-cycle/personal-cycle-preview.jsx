import { createRoot } from 'react-dom/client';
import PersonalCycleWorkspace from './PersonalCycleWorkspace';
import { demoData } from './demoRecords';

function App() {
  return (
    <div className="stage">
      <div className="mobile">
        <PersonalCycleWorkspace 
          records={demoData.records} 
          isDemo={true}
          onRecordChange={(updatedRecord) => {
            console.log('Record updated:', updatedRecord);
          }}
        />
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
