import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ username: '', password: '', remember: false });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setValues((v) => ({ ...v, [name]: type === 'checkbox' ? checked : value }));
    setErrors((ePrev) => ({ ...ePrev, [name]: '' }));
    setServerError('');
  };

  const validate = () => {
    const e = {};
    if (!values.username) e.username = 'Username is required';
    if (!values.password) e.password = 'Password is required';
    else if (values.password.length < 6) e.password = 'Min 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError('');

    // Simulate API call
    try {
      // Call backend API for login
      const res = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: values.username, password: values.password })
      });
      if (!res.ok) throw new Error('Invalid credentials');
  const data = await res.json();
  // store position and username for dashboards and navigate to dashboard replacing history
  sessionStorage.setItem('msms_position', data.position || '');
  sessionStorage.setItem('msms_username', data.username || values.username || '');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setServerError('Invalid username or password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center bg-light">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-5">
            <div className="card shadow-sm border-0">
              <div className="card-body p-4 p-md-5">
                <h1 className="h3 mb-3 text-center">Log in</h1>
                {serverError && (
                  <div className="alert alert-danger" role="alert">
                    {serverError}
                  </div>
                )}
                <form onSubmit={onSubmit} noValidate>
                  <div className="mb-3">
                    <label htmlFor="username" className="form-label">Username</label>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      className={`form-control ${errors.username ? 'is-invalid' : ''}`}
                      placeholder="Enter your username"
                      value={values.username}
                      onChange={onChange}
                      disabled={submitting}
                      autoComplete="username"
                      required
                    />
                    {errors.username && <div className="invalid-feedback">{errors.username}</div>}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="password" className="form-label">Password</label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                      placeholder="••••••••"
                      value={values.password}
                      onChange={onChange}
                      disabled={submitting}
                      autoComplete="current-password"
                      required
                    />
                    {errors.password && <div className="invalid-feedback">{errors.password}</div>}
                  </div>

                  <div className="mb-3">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="remember"
                        name="remember"
                        checked={values.remember}
                        onChange={onChange}
                        disabled={submitting}
                      />
                      <label className="form-check-label" htmlFor="remember">
                        Remember me
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                        Logging in…
                      </>
                    ) : (
                      'Log in'
                    )}
                  </button>
                </form>

                {/* Registration and password recovery options removed */}
              </div>
            </div>

            <p className="text-center text-muted mt-3 mb-0 small">
              By continuing you agree to our <a href="#" className="text-decoration-none">Terms</a> and <a href="#" className="text-decoration-none">Privacy</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
