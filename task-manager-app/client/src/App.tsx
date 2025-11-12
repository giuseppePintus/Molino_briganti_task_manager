import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import OperatorsCarousel from './pages/OperatorsCarousel';
import Dashboard from './pages/Dashboard';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';

const App: React.FC = () => {
  return (
    <Router>
      <Switch>
        <Route path="/admin/dashboard" component={AdminDashboard} />
        <Route path="/admin" exact component={AdminLogin} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/" exact component={OperatorsCarousel} />
      </Switch>
    </Router>
  );
};

export default App;