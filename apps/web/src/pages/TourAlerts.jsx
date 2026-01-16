import { useState } from 'react';
import { EnhancedSearchForm } from '../components/EnhancedSearchForm';

const TourAlerts = () => {
  const [showForm, setShowForm] = useState(true);

  return (
    <div className="page-shell">
      <div className="page-container">
        <div className="flight-price-alert">
          <div className="alert-header">
            <h2>Tour Alerts</h2>
            <p>Get notified when new tours match your destination, dates, and budget.</p>
          </div>

          <div className="create-alert-section">
            <button
              className="create-alert-btn"
              onClick={() => setShowForm((prev) => !prev)}
              type="button"
            >
              {showForm ? 'Hide form' : 'Create tour alert'}
            </button>
          </div>

          {showForm && (
            <div className="alert-form-container">
              <EnhancedSearchForm onSearch={async () => {}} />
            </div>
          )}

          <div className="active-alerts-section">
            <h3>Active tour alerts (0)</h3>
            <div className="no-alerts">
              <p>No tour alerts yet. Create your first alert to get updates.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TourAlerts;
