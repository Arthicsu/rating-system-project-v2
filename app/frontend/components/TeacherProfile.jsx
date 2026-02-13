`use client`;
import { useState, useMemo, useEffect } from 'react';
import api from '@/lib/axios';

const getSemesterRanges = () => {
  const currentYear = new Date().getFullYear();
  return [
    { 
      label: `Весна ${currentYear}`, 
      start: new Date(currentYear, 1, 1), // 1 Февраля
      end: new Date(currentYear, 7, 31)   // 31 Августа
    },
    { 
      label: `Осень ${currentYear - 1}`, // Прошлая осень
      start: new Date(currentYear - 1, 8, 1), // 1 Сентября
      end: new Date(currentYear, 0, 31)   // 31 Января
    },
    { 
        label: `Осень ${currentYear}`, // Текущая/Будущая осень
        start: new Date(currentYear, 8, 1), 
        end: new Date(currentYear + 1, 0, 31) 
      },
    { label: 'За всё время', start: null, end: null }
  ];
};

export default function TeacherProfile({profile, isOwner}) {
  const [activeTab, setActiveTab] = useState(`my-group`);
  const [localProfile, setLocalProfile] = useState(profile);
  const [rejectReasons, setRejectReasons] = useState([]);

  const [modalState, setModalState] = useState({
    type: null, 
    targetId: null, 
    targetScore: 0,
    targetStudentId: null 
  });

  const initialGroupId = (profile.curated_groups && profile.curated_groups.length > 0) ? profile.curated_groups[0].id : 'all';
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [searchTerm, setSearchTerm] = useState('');
  
  const semesterOptions = getSemesterRanges();
  const [selectedSemester, setSelectedSemester] = useState(semesterOptions[0].label);

  const openModal = (type, doc) => setModalState({ 
      type, 
      targetId: doc.id, 
      targetScore: doc.score,
      targetStudentId: doc.student_id 
  });

  const closeModal = () => {
      setModalState({ type: null, targetId: null, targetScore: 0, targetStudentId: null });
      setRejectReasons([]); 
  };
  
  const filteredStudents = useMemo(() => {
    let students = localProfile.students_list || [];
    if (selectedGroupId != 'all') {
      students = students.filter(s => s.group_id == Number(selectedGroupId));
    }
    if (searchTerm.trim() != '') {
      const lowerTerm = searchTerm.toLowerCase();
      students = students.filter(s => 
        s.full_name.toLowerCase().includes(lowerTerm) || 
        (s.record_book && s.record_book.toLowerCase().includes(lowerTerm))
      );
    }
    return students;
  }, [localProfile.students_list, selectedGroupId, searchTerm]);


  const filteredDocs = useMemo(() => {
    let docs = localProfile.pending_documents || [];
    if (selectedGroupId != 'all') {
      docs = docs.filter(d => d.group_id == Number(selectedGroupId));
    }
    const currentRange = semesterOptions.find(opt => opt.label == selectedSemester);
    if (currentRange && currentRange.start) {
        docs = docs.filter(d => {
            const docDate = new Date(d.uploaded_at); 
            return docDate >= currentRange.start && docDate <= currentRange.end;
        });
    }
    return docs;
  }, [localProfile.pending_documents, selectedGroupId, selectedSemester]);

  const dynamicStats = useMemo(() => {
    const students = filteredStudents;
    const count = students.length;
    
    if (count == 0) return {
      total_students: 0, avg_score: 0, max_score: 0, min_score: 0,
      active_requests: 0, top5: [], categories: {}
    };

    const scores = students.map(s => s.total_score);
    const totalSum = scores.reduce((acc, val) => acc + val, 0);
    
    // Распределение по категориям (суммируем баллы из студентов)
    const catStats = {
      "Учебная": students.reduce((acc, s) => acc + (s.academic_score || 0), 0),
      "Научная": students.reduce((acc, s) => acc + (s.research_score || 0), 0),
      "Спорт": students.reduce((acc, s) => acc + (s.sport_score || 0), 0),
      "Общественная": students.reduce((acc, s) => acc + (s.social_score || 0), 0),
      "Культурно-творческая": students.reduce((acc, s) => acc + (s.cultural_score || 0), 0),
    };

    // Топ 5
    const top5 = [...students]
      .sort((a, b) => b.total_score - a.total_score)
      .slice(0, 5);

    return {
      total_students: count,
      avg_score: Math.round(totalSum / count),
      max_score: Math.max(...scores),
      min_score: Math.min(...scores),
      active_requests: filteredDocs.length,
      top5: top5,
      categories: catStats
    };
  }, [filteredStudents, filteredDocs]);

  const handleApprove = async () => {
    if (!modalState.targetId) return;

    try {
      await api.post(`/university_structure/api/v1/document/${modalState.targetId}/review/`, {
        action: 'approve'
      });

      setLocalProfile(prev => {
          const newPending = prev.pending_documents.filter(doc => doc.id != modalState.targetId);
          
          const newStudentsList = prev.students_list.map(student => {
              if (student.id == modalState.targetStudentId) {
                  return {
                      ...student,
                      total_score: student.total_score + modalState.targetScore
                  };
              }
              return student;
          });

          return {
              ...prev,
              pending_documents: newPending,
              students_list: newStudentsList
          };
      });

      closeModal();
    } catch (error) {
      console.error("Ошибка при одобрении:", error);
      alert("Не удалось одобрить заявку");
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!modalState.targetId) return;

    if (rejectReasons.length == 0) {
      alert("Выберите хотя бы одну причину");
      return;
    }

    try {
      await api.post(`/user/api/v1/document/${modalState.targetId}/review/`, {
        action: 'reject',
        reasons: rejectReasons
      });

      setLocalProfile(prev => ({
        ...prev,
        pending_documents: prev.pending_documents.filter(doc => doc.id !== modalState.targetId)
      }));

      closeModal();
    } catch (error) {
      console.error("Ошибка при отклонении:", error);
      alert("Не удалось отклонить заявку");
    }
  };

  const toggleReason = (reason) => {
    setRejectReasons(prev => 
      prev.includes(reason) ? prev.filter(r => r != reason) : [...prev, reason]
    );
  };

  const curatedGroups = profile.curated_groups && profile.curated_groups.length > 0 ? profile.curated_groups.map(g => g.name).join(', ') : "Нет курируемых групп";
  const groupsList = profile.curated_groups || [];
  const currentGroupName = groupsList.find(g => g.id == selectedGroupId)?.name || "Все группы";
  // Ну да, хардкод, потом пофиксим
  const reasonsRejectArr = [
    "Неверно указана категория",
    "Неверно указано достижение / уровень",
    "Неверно загружен файл с достижением",
    "Неверно указан результат / место",
    "Неверное описание"
  ];

  return (
    <>
      <main className="main-layout">
        <div className="container">
          <div className="profile-card">
            <h1 className="profile-card__title">Информация о Вас</h1>
            <div className="profile-card__grid">
              <div className="profile-card__col">
                <div className="profile-item"><span className="profile-label">ФИО</span><span className="profile-value">{profile.full_name}</span></div>
                <div className="profile-item"><span className="profile-label">Факультет</span><span className="profile-value">{profile.faculty || "Не указан"}</span></div>
              </div>
              <div className="profile-card__col">
                <div className="profile-item"><span className="profile-label">Должность</span><span className="profile-value">{profile.position || "Преподаватель"}</span></div>
                <div className="profile-item"><span className="profile-label">Электронная почта</span><span className="profile-value link">{profile.email || "Не указан адрес эл.почты"}</span></div>
              </div>
              <div className="profile-card__col" style={{gap:'10px'}}>
                {/* <div className="profile-item"><span className="profile-label">Курируемые группы</span><span className="profile-value">{curatedGroups}</span></div> */}
              <label className="profile-label" style={{fontSize:'12px', color:'#666', display:'block', marginBottom:'4px'}}>Курируемая группа</label>
              <select className="profile-item" 
                  value={selectedGroupId} 
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  style={{padding:'2px', borderRadius:'6px', border:'1px solid #ddd', width:'100px'}}
              >
                  {groupsList.map(g => (
                      <option className='profile-value' key={g.id} value={g.id}>{g.name}</option>
                  ))}
                  {groupsList.length == 0 && <option value="all">Нет групп</option>}
              </select>
                <div className="profile-item"><span className="profile-label">Номер телефона</span><span className="profile-value">{profile.phone || "Не указан номер телефона"}</span></div>
              </div>
            </div>
          </div>

          <div className="nav-tabs">
            <a className={`nav-tab ${activeTab == `my-group` ? `active`:``}`} onClick={() => setActiveTab(`my-group`)}>
                Моя группа
            </a>
            <a className={`nav-tab ${activeTab == `pending-requests` ? `active`:``}`} onClick={() => setActiveTab(`pending-requests`)}>
                Заявки на подтверждение
                {filteredDocs.length > 0 && <span className="badge-count" style={{marginLeft:'5px', background:'#E11D48', color:'white', borderRadius:'10px', padding:'2px 6px', fontSize:'11px'}}>{filteredDocs.length}</span>}
            </a>
            <a className={`nav-tab ${activeTab == `statistics` ? `active`:``}`} onClick={() => setActiveTab(`statistics`)}>
                Статистика
            </a>
          </div>


          {/* Контент вкладок */}
        {activeTab == `my-group` && (
          <div className="tab-content active">
            <div className="students-section">
              <div className="students-header-row">
                <h2 className="section-title">Список студентов группы {currentGroupName} (студентов:{filteredStudents.length})</h2>
                {/* <label style={{fontSize:'12px', color:'#666', display:'block', marginBottom:'4px'}}>Семестр: </label> */}
                <div className="filter-item">
                    <select 
                        className="custom-select"
                        value={selectedSemester}
                        onChange={(e) => setSelectedSemester(e.target.value)}
                        style={{padding:'8px', borderRadius:'6px', border:'1px solid #ddd'}}
                    >
                        {semesterOptions.map(opt => (
                            <option key={opt.label} value={opt.label}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <div className="search-wrapper">
                  <i className="fa-solid fa-magnifying-glass search-icon"></i>
                  <input type="text" className="search-input" style={{width: '200px'}} placeholder="Поиск по ФИО или зачетке" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                </div>
              </div>
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr><th>ФИО Студента</th><th>Зачетная книжка</th><th>Общий балл</th><th>Действия</th></tr>
                  </thead>
                  <tbody>
                      {filteredStudents.length > 0 ? filteredStudents.map((student, idx) => (
                      <tr key={student.id}>
                        <td>
                          <div className="student-name-wrapper" style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <div className="count-badge" style={{background: '#0050CF', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px'}}>
                              {idx + 1}
                            </div>
                            <span>{student.full_name}</span>
                          </div>
                        </td>
                        <td>{student.record_book || "—"}</td>
                        <td style={{color: '#0050CF', fontWeight: 'bold'}}>{student.total_score}</td>
                        <td>
                            <a href={`/profile/${student.user_id}`} className="profile-view-link header-link__item" style={{textDecoration: 'none', color: '#333'}}>
                              Профиль
                            </a>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} style={{textAlign: 'center', padding: '20px'}}>Студенты не найдены</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          )}
          
        {activeTab == `pending-requests` && (
          <div className="tab-content active">
              <div className="students-section">
                <div className="students-header-row" style={{marginBottom:'15px'}}>
                  <h2 className="section-title">Заявки: {selectedSemester}</h2>
                </div>
                <div className="table-wrapper">
                  <table className="custom-table">
                  <thead style={{backgroundColor: '#6B7A99'}}>
                      <tr><th>ФИО Студента</th><th>Категория</th><th>Достижение / Уровень</th><th>Результат / Место</th><th>Описание</th><th>Дата</th><th>Баллы</th><th>Действия</th></tr>
                  </thead>
                  <tbody>
                      {filteredDocs.length > 0 ? filteredDocs.map((doc) => (
                      <tr key={doc.id}>
                          <td>
                              <div>{doc.student_name}</div>
                              <div style={{fontSize: '11px', color: '#666'}}>{doc.record_book}</div>
                          </td>
                          <td>
                              {doc.category_display}
                          </td>
                          <td>
                              {doc.sub_type_display} / {doc.level_display}
                          </td>
                          <td>
                              <div>{doc.result_display}</div>
                          </td>
                          <td>
                              <div>{doc.achievement}</div>
                          </td>
                          <td>
                                {doc.file_url ? (
                                  <a href={doc.file_url} target="_blank" className="link" style={{fontSize:'12px', display:'flex', alignItems:'center', gap:'5px'}}>
                                    <i className="fa-solid fa-file"></i> Документ
                                  </a>
                                ) : <span style={{color:'#999', fontSize:'12px'}}>Нет файла</span>}
                                <div style={{fontSize:'10px', color:'#999', marginTop:'4px'}}>{new Date(doc.uploaded_at).toLocaleDateString('ru-RU')}</div>
                          </td>
                          <td className="score-text">+{doc.score}</td>
                          <td style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button className="btn-approve" onClick={() => openModal('approve', doc)} title="Одобрить">
                              Одобрить
                            </button>
                            <button className="btn-reject" onClick={() => openModal('reject', doc)} title="Отклонить">
                              Отклонить
                            </button>
                          </td>
                      </tr>
                      )) : (
                      <tr><td colSpan={8}>
                          Нет заявок за период "{selectedSemester}" в группе "{currentGroupName}"
                      </td></tr>
                      )}
                  </tbody>
                  </table>
                </div>
              </div>
          </div>
        )}

        {activeTab == `statistics` && (
          <div className="tab-content active">
            <h2 className="section-title" style={{ marginBottom: '20px' }}>
              Аналитика: {currentGroupName} <span style={{fontSize: '14px', color: '#666', fontWeight: 'normal'}}>({selectedSemester})</span>
            </h2>

            <div className="stats-top-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
              <div className="profile-card stats-box" style={{ padding: '15px' }}>
                <div style={{ fontSize: '12px', color: '#666' }}>Студентов</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0050CF' }}>{dynamicStats.total_students}</div>
              </div>
              <div className="profile-card stats-box" style={{ padding: '15px' }}>
                <div style={{ fontSize: '12px', color: '#666' }}>Средний балл</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0050CF' }}>{dynamicStats.avg_score}</div>
              </div>
              <div className="profile-card stats-box" style={{ padding: '15px' }}>
                <div style={{ fontSize: '12px', color: '#666' }}>Максимальный / Минимальный</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{dynamicStats.max_score} <span style={{ fontWeight: 'normal', color: '#ccc' }}>|</span> {dynamicStats.min_score}</div>
              </div>
              <div className="profile-card stats-box" style={{ padding: '15px', borderLeft: '4px solid #E11D48' }}>
                <div style={{ fontSize: '12px', color: '#666' }}>Активные заявки</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#E11D48' }}>{dynamicStats.active_requests}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
              
              <div className="profile-card">
                <h3 style={{ fontSize: '16px', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Распределение баллов</h3>
                <div className="category-distribution">
                  {Object.entries(dynamicStats.categories).map(([label, value]) => {
                    const percentage = dynamicStats.avg_score > 0 ? Math.min((value / (dynamicStats.avg_score * dynamicStats.total_students)) * 100, 100) : 0;
                    return (
                      <div key={label} style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                          <span>{label}</span>
                          <strong>{value} б.</strong>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${percentage || 0}%`, height: '100%', background: '#0050CF', transition: 'width 0.3s' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="profile-card">
                <h3 style={{ fontSize: '16px', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Топ-5 студентов по баллам</h3>
                <table className="custom-table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Место</th>
                      <th>ФИО</th>
                      <th>Балл</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dynamicStats.top5.map((student, idx) => (
                      <tr key={student.id}>
                        <td style={{ width: '50px' }}>
                          <span style={{ background: '#0050CF66', color: '#000', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                            {idx+1}
                          </span>
                        </td>
                        <td>{student.full_name}</td>
                        <td style={{ fontWeight: 'bold', color: '#0050CF' }}>{student.total_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        </div>
      </main>

      {/* Модалки */}
    {modalState.type == `approve` && (
      <div className="modal-overlay active" onClick={(e) => { if(e.target == e.currentTarget) closeModal() }}>
        <div className="modal-content success-modal">
          <button className="modal-close" onClick={closeModal}>&times;</button>
          <h2 className="modal-title">Подтвердить достижение?</h2>
          <p className="modal-text">Студенту будет начислено <b>{modalState.targetScore}</b> балл(-ов).</p>
          <div style={{marginTop: '20px', textAlign: 'center'}}>
              <button className="btn-approve" style={{width: '100%'}} onClick={handleApprove}>Подтвердить</button>
          </div>
          <div className="modal-logo-wrapper">
            <img src="/media/logo_BGITU.png" alt="БГИТУ" className="modal-mini-logo" />
          </div>
        </div>
      </div>
    )}
    {modalState.type == `reject` && (
      <div id="modal-reject" className="modal-overlay active" onClick={(e) => { if(e.target == e.currentTarget) closeModal() }}>
        <div className="modal-content reject-modal">
          <h2 className="modal-title">Укажите причину отказа</h2>
            <form className="reject-form" onSubmit={handleReject}>
              {reasonsRejectArr.map((reason, i) => (
                <label key={i} className="checkbox-container">
                  {reason}
                  <input type="checkbox" onChange={() => toggleReason(reason)} checked={rejectReasons.includes(reason)}/>
                </label>
              ))}
              <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
                <button type="submit" className="btn-send-reject">Отправить</button>
                <button type="button" className="btn-send-reject" style={{background: '#ccc'}} onClick={closeModal}>Отмена</button>
              </div>
          </form>
        </div>
      </div>
    )}
    </>
  );
}