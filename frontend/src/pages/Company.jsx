/**
 * Company.jsx  (Module 5 - Company Profile Management)
 * -----------
 * One form with three sections: basic details, contact, business
 * registration (GSTIN / PAN / CIN). Logo upload with instant preview.
 */
import { useEffect, useRef, useState } from 'react';
import { Upload, Save, Building2 } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Field, Loader, useToast } from '../components/ui';
import { formatDateTime } from '../utils/format';

const SECTIONS = [
  { title: 'Company details', fields: [
    ['name', 'Company name *'], ['legal_name', 'Legal name'], ['tagline', 'Tagline', true],
  ] },
  { title: 'Contact information', fields: [
    ['email', 'Email'], ['phone', 'Phone'], ['website', 'Website', true], ['address', 'Address', true],
    ['city', 'City'], ['state', 'State'], ['pincode', 'Pincode'], ['country', 'Country'],
  ] },
  { title: 'Business registration', fields: [
    ['gstin', 'GSTIN', false, '15 characters, e.g. 36AABCT1234F1Z5'], ['pan', 'PAN', false, 'e.g. AABCT1234F'],
    ['cin', 'CIN', false, '21 characters'], ['registration_date', 'Registration date', false, null, 'date'],
  ] },
];

export default function Company() {
  const { can } = useAuth();
  const toast = useToast();
  const editable = can('COMPANY_UPDATE');
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const fill = (data) => {
    setProfile(data);
    const values = {};
    SECTIONS.flatMap((s) => s.fields).forEach(([key]) => { values[key] = data[key] ?? ''; });
    setForm(values);
  };

  useEffect(() => { api.get('/company').then(({ data }) => fill(data)).catch((e) => toast(errorMessage(e), 'error')); }, [toast]);

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const { data } = await api.put('/company', form);
      fill(data);
      toast('Company profile saved');
    } catch (err) {
      setErrors(fieldErrors(err));
      toast(errorMessage(err), 'error');
    } finally { setSaving(false); }
  };

  const uploadLogo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const body = new FormData();
    body.append('logo', file); // field name must be "logo"
    try {
      const { data } = await api.post('/company/logo', body);
      fill(data);
      toast('Logo updated');
    } catch (err) { toast(errorMessage(err), 'error'); }
    e.target.value = '';
  };

  if (!profile) return <Loader />;

  return (
    <>
      <PageHeader title="Company Profile" subtitle={`Last updated ${formatDateTime(profile.updated_at)}`}>
        {editable && <button className="btn btn-primary" onClick={save} disabled={saving}><Save size={16} /> {saving ? 'Saving…' : 'Save changes'}</button>}
      </PageHeader>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18, alignItems: 'start' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ width: 140, height: 140, borderRadius: 20, margin: '6px auto 14px', background: '#f3f5fa', display: 'grid', placeItems: 'center', overflow: 'hidden', border: '1px solid var(--border)' }}>
            {profile.logo_url ? <img src={profile.logo_url} alt="Company logo" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <Building2 size={56} color="#94a3b8" />}
          </div>
          <h2>{profile.name}</h2>
          <p className="muted">{profile.tagline}</p>
          {editable && (
            <>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={uploadLogo} />
              <button className="btn" style={{ marginTop: 14 }} onClick={() => fileRef.current.click()}><Upload size={15} /> Upload logo</button>
              <p className="small muted" style={{ marginTop: 6 }}>PNG, JPG or WEBP · max 2 MB</p>
            </>
          )}
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          {SECTIONS.map((section) => (
            <div className="card" key={section.title}>
              <h2 style={{ marginBottom: 14 }}>{section.title}</h2>
              <div className="form-grid">
                {section.fields.map(([key, label, full, hint, type]) => (
                  <Field key={key} label={label} error={errors[key]} hint={hint} full={full}>
                    <input className="input" type={type || 'text'} value={form[key] ?? ''} disabled={!editable}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                  </Field>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
