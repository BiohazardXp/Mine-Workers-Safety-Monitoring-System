import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ManageUsers = () => {
  const [employees, setEmployees] = useState([]);
  const [logins, setLogins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [er, lr] = await Promise.all([
        fetch('http://localhost:3001/api/employees').then(r => r.json()),
        fetch('http://localhost:3001/api/logins').then(r => r.json()),
      ]);
      setEmployees(er || []);
      setLogins(lr || []);
    } catch (e) { setErr('Failed to load'); }
    setLoading(false);
  };

  const addEmployee = async () => {
    const first_name = prompt('First name');
    if (!first_name) return;
    const surname = prompt('Surname') || '';
    const position = prompt('Position (e.g. miner, supervisor)') || '';
    try {
      await fetch('http://localhost:3001/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first_name, surname, position }) });
      fetchAll();
    } catch (e) { setErr('Create failed'); }
  };

  const editEmployee = async (emp) => {
    const first_name = prompt('First name', emp.first_name);
    if (first_name === null) return;
    const surname = prompt('Surname', emp.surname);
    if (surname === null) return;
    const position = prompt('Position', emp.position);
    if (position === null) return;
    try {
      await fetch(`http://localhost:3001/api/employees/${emp.emp_id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first_name, surname, position }) });
      fetchAll();
    } catch (e) { setErr('Update failed'); }
  };

  const deleteEmployee = async (emp) => {
    if (!confirm(`Delete ${emp.first_name} ${emp.surname}?`)) return;
    try {
      await fetch(`http://localhost:3001/api/employees/${emp.emp_id}`, { method: 'DELETE' });
      fetchAll();
    } catch (e) { setErr('Delete failed'); }
  };

  const createLogin = async (emp) => {
    const username = prompt('Username for login (will be saved)');
    if (!username) return;
    const position = prompt('Position for login (supervisor or admin)', 'supervisor');
    if (!['supervisor','admin'].includes(position)) { alert('Position must be supervisor or admin'); return; }
    const password = prompt('Password for login');
    if (!password) return;
    try {
      await fetch('http://localhost:3001/api/logins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: emp.emp_id, username, position, password }) });
      fetchAll();
    } catch (e) { setErr('Login create failed'); }
  };

  const deleteLogin = async (login) => {
    if (!confirm(`Delete login ${login.username}?`)) return;
    try {
      await fetch(`http://localhost:3001/api/logins/${login.id}`, { method: 'DELETE' });
      fetchAll();
    } catch (e) { setErr('Delete failed'); }
  };

  return (
    <div className="container mt-5">
      <button className="btn btn-secondary mb-3" onClick={() => navigate('/')}>Back to Dashboard</button>
      <h2>Manage Users</h2>
      {err && <div className="text-danger">{err}</div>}
      <div className="d-flex gap-24">
        <div className="flex-1">
          <h4>Employees</h4>
          <button className="btn btn-primary" onClick={addEmployee}>Add Employee</button>
          {loading ? <p>Loading...</p> : (
            <table className="table mt-2">
              <thead><tr><th>ID</th><th>First</th><th>Surname</th><th>Position</th><th>Actions</th></tr></thead>
              <tbody>
                {employees.map(e => (
                  <tr key={e.emp_id}>
                    <td>{e.emp_id}</td>
                    <td>{e.first_name}</td>
                    <td>{e.surname}</td>
                    <td>{e.position}</td>
                    <td>
                      <button className="btn btn-sm btn-outline-primary me-2" onClick={() => editEmployee(e)}>Edit</button>
                      <button className="btn btn-sm btn-outline-danger me-2" onClick={() => deleteEmployee(e)}>Delete</button>
                      {String(e.position || '').toLowerCase() !== 'miner' && (
                        <button className="btn btn-sm btn-outline-success" onClick={() => createLogin(e)}>Create Login</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
  <div className="w-360">
          <h4>Logins</h4>
          {loading ? <p>Loading...</p> : (
            <table className="table">
              <thead><tr><th>ID</th><th>Username</th><th>Position</th><th>Actions</th></tr></thead>
              <tbody>
                {logins.map(l => (
                  <tr key={l.id}>
                    <td>{l.id}</td>
                    <td>{l.username}</td>
                    <td>{l.position}</td>
                    <td><button className="btn btn-sm btn-outline-danger" onClick={() => deleteLogin(l)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageUsers;
