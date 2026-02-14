'use client';


import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { useRouter } from 'next/navigation';
import { useMySession } from '@/context/AuthContext';
export default function UploadAchievement() {
  const router = useRouter();
  const { user, loading: authLoading } = useMySession();

  const [dataStructure, setDataStructure] = useState({});
  const [levelsList, setLevelsList] = useState([]);
  const [resultsList, setResultsList] = useState([]);
  const [docTypesList, setDocTypesList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [recordBook, setRecordBook] = useState(user?.record_book || '');
  const [achievementName, setAchievementName] = useState('');
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState(null);
  const [subType, setSubType] = useState(null);
  const [level, setLevel] = useState(null);
  const [result, setResult] = useState(null);
  const [docType, setDocType] = useState(null);

  const [showCategory, setShowCategory] = useState(false);
  const [showSubType, setShowSubType] = useState(false);
  const [showLevel, setShowLevel] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showDocType, setShowDocType] = useState(false);
    
  useEffect(() => {
    if (user?.record_book) {
      setRecordBook(user.record_book);
    }
  }, [user]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await api.get('/student/api/v1/achievement-config/');
        const {structure, levels, results, doc_types} = response.data;
        setDataStructure(structure);
        setLevelsList(levels);
        setResultsList(results);
        setDocTypesList(doc_types);
        setLoading(false);
      } catch (e) {
        console.error("Failed to load config", e);
        alert("Ошибка при загрузке структуры данных");
      }
    };
    fetchConfig();
  }, []);

  if (authLoading) return <p>Загрузка...</p>;
  if (!user) return <p>Нужно войти в систему</p>;

  // потом заюзаю
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

const handleSubmit = async () => {
    if (!recordBook || !category || !subType || !achievementName || !docType) {
      alert("Пожалуйста, заполните все обязательные поля (категория, вид, тип документа, название).");
      return;
    }

    const formData = new FormData();
    formData.append('record_book', recordBook);
    formData.append('category', category);
    formData.append('sub_type', subType.value);
    formData.append('achievement', achievementName);
    
    if (docType) {
        formData.append('doc_type', docType.value);
    }

    if (subType.needsLevel && level) formData.append('level', level.value);
    if (subType.needsResult && result) formData.append('result', result.value);
    
    if (file) {
        formData.append('files', file);
    }

    try {
      const response = await api.post('/student/api/v1/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Достижение успешно загружено!');
      router.push('/profile');
    } catch (error) {
      console.error(error);
      alert('Ошибка при загрузке. Проверьте данные.');
    }
  };

  return (
    <>
      <section className="achievements">
        <div className="container">
          <h1 className="achievements-title">Загрузка достижений</h1>
          <div className="achievements-main">
            <div className="achievements-form">
              <div className="achievements-input">
              <label className="label-login">Номер зачетной книги</label>
              <input className="achievements-button" type="text" value={recordBook} readOnly style={{ backgroundColor: '#0050CF66', cursor: 'not-allowed' }}/>
            </div>
              
              <div className="achievements-input">
                <label className="label-login">*Категория</label>
                <div className="achievements-button" onClick={() => setShowCategory(!showCategory)}>
                  {category ? dataStructure[category].label : 'Выберите категорию'} <span>▼</span>
                </div>
                {showCategory && (
                  <div className="achievements-dropdown-list" style={{zIndex: 10}}>
                    {Object.keys(dataStructure).map((key) => (
                      <div key={key} className="achievements-button achievements-item-select" 
                      onClick={() => {setCategory(key); setSubType(null); setLevel(null); setResult(null); setShowCategory(false);}}>
                        {dataStructure[key].label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {category && (
                <div className="achievements-input">
                  <label className="label-login">*Вид деятельности</label>
                  <div className="achievements-button" onClick={() => setShowSubType(!showSubType)}>
                    {subType ? subType.label : 'Выберите вид деятельности'} <span>▼</span>
                  </div>
                  {showSubType && (
                    <div className="achievements-dropdown-list" style={{zIndex: 9}}>
                      {dataStructure[category].sub_types.map((item) => (
                        <div key={item.value} className="achievements-button achievements-item-select" 
                        onClick={() => {setSubType(item); setLevel(null); setResult(null); setShowSubType(false);}}>
                          {item.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {subType?.needsLevel && (
                <div className="achievements-input">
                  <label className="label-login">*Уровень мероприятия</label>
                  <div className="achievements-button" onClick={() => setShowLevel(!showLevel)}>
                    {level ? level.label : 'Выберите уровень'} <span>▼</span>
                  </div>
                  {showLevel && (
                    <div className="achievements-dropdown-list" style={{zIndex: 8}}>
                      {levelsList.map((item) => (
                        <div key={item.value} className="achievements-button achievements-item-select" onClick={() => { setLevel(item); setShowLevel(false); }}>
                          {item.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {subType?.needsResult && (
                <div className="achievements-input">
                  <label className="label-login">*Результат / Место</label>
                  <div className="achievements-button" onClick={() => setShowResult(!showResult)}>
                    {result ? result.label : 'Выберите результат'} <span>▼</span>
                  </div>
                  {showResult && (
                    <div className="achievements-dropdown-list" style={{zIndex: 7}}>
                      {resultsList.map((item) => (
                        <div key={item.value} className="achievements-button achievements-item-select" onClick={() => { setResult(item); setShowResult(false); }}>
                          {item.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="achievements-input">
                <label className="label-login">*Тип документа</label>
                <div className="achievements-button" onClick={() => setShowDocType(!showDocType)}>
                  {docType ? docType.label : 'Выберите тип документа'} <span>▼</span>
                </div>
                {showDocType && (
                  <div className="achievements-dropdown-list" style={{zIndex: 6}}>
                    {docTypesList.map((item) => (
                      <div key={item.value} className="achievements-button achievements-item-select" onClick={() => { setDocType(item); setShowDocType(false); }}>
                        {item.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="achievements-input">
                <label className="label-login">*Название достижения (как в документе)</label>
                <input className="achievements-button" type="text" placeholder="Например: Грамота за 1 место в..." value={achievementName}
                onChange={(e) => setAchievementName(e.target.value)}
                />
              </div>

              <div className="achievements-input">
                <label style={{ cursor: 'pointer' }}>
                  <input type="file" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0])} />
                  <div className="achievements-button">
                    {file ? `Файл: ${file.name}` : 'Нажмите сюда, чтобы загрузить документ'}
                  </div>
                </label>
              </div>
          </div>

            <div className="achievements-img">
              <div className="achievements-flex" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                
                <div className="achievements-info-block" style={{ flex: 1 }}>
                  <p className="achievements-text-footer" style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                    Актуальную разбалловку Вы можете узнать,<br />
                    перейдя по ссылке или отсканировав QR-код:<br />
                    <a href="https://clck.ru/3RRp3V" target="_blank" style={{ color: '#0050CF', textDecoration: 'none' }}>clck.ru/3RRp3V</a>
                  </p>
                  
                  <button 
                    className="achievements-submit-btn" 
                    onClick={handleSubmit}
                    style={{
                      backgroundColor: '#A3FFB4',
                      color: '#41704B',         
                      border: 'none',
                      padding: '10px 25px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: '500'
                    }}
                  >
                    Загрузить
                  </button>
                </div>

                <div className="achievements-qrcode-wrapper">
                  <img 
                    className="qrcode" 
                    src="/media/frame.png" 
                    alt="QR" 
                    style={{ width: '120px', height: '120px', objectFit: 'contain' }}
                  />
                </div>

              </div>
              
              <p style={{ marginTop: '20px', fontSize: '13px', color: '#888' }}>
                Система автоматически рассчитает баллы на основе выбранных критериев.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}