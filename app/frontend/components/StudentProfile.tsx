import {Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, } from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

function AchievementItem({ doc } : {doc: any}) {
  const statusIcon = doc.status == 'rejected' ? 'fa-circle-xmark' : 'fa-file-lines';

  return (
    <div className="doc-item">
      <div className="doc-info">
        <i className={`fa-regular ${statusIcon}`}></i>
        <div>
          <p className="doc-name reason-text">{doc.achievement}</p>
          <span className="doc-meta">
            <i className="fa-regular fa-bookmark"></i><span className="tag" style={{marginLeft: '4px'}}>{doc.category_display}</span>
            <span className="tag-category" style={{marginLeft: '4px'}}>{doc.sub_type_display}</span> &nbsp; 
            {doc.level != 'none' && <span className="tag-category">{doc.level_display}</span>} &nbsp;
            {doc.result && <span className="tag-category">{doc.result_display}</span>} &nbsp;
          </span>
          
          {doc.file_url && (
            <div style={{marginTop: '5px'}}>
              <i className="fa-regular fa-calendar"></i> {new Date(doc.uploaded_at).toLocaleDateString()} &nbsp; 
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="view-doc-link" style={{fontSize: '12px', color: '#0050CF'}}>
                <i className="fa-solid fa-paperclip"></i> {doc.original_file_name || 'Просмотреть файл'}
              </a>
            </div>
          )}
        </div>
      </div>

      {doc.status == 'rejected' ? (
        <div className="doc-reason">
          <span className="reason-text">Причина: {doc.rejection_reason || 'Не указана'}</span>
        </div>
      ) : (
        <div className="doc-points" style={{fontWeight: 'bold', color: '#4caf50'}}>
          +{doc.score}
        </div>
      )}
    </div>
  );
}

export default function StudentProfile({ profile, isOwner }: { profile: any, isOwner: any }) {
  const data = {
    labels: profile.radar_stats.labels,
    datasets: [
      {
        label: 'Баллы',
        data: profile.radar_stats.data,
        backgroundColor: 'rgba(0, 80, 207, 0.2)',
        borderColor: '#0050CF',
        borderWidth: 2,
        pointBackgroundColor: '#0050CF',
      },
    ],
  };

  const options = {
    scales: {
      r: {
        angleLines: { display: true },
        suggestedMin: 0,
        suggestedMax: 15,
      },
    },
    plugins: {
      legend: { display: false },
    },
  };

  const documents = profile.documents || [];
  const approvedDocs = documents.filter((d: any) => d.status == 'approved');
  const pendingDocs = documents.filter((d: any) => d.status == 'pending');
  const rejectedDocs = documents.filter((d: any) => d.status == 'rejected');
  
    return (
    <>
        <section className="profile">
        <div className="container">
            <div className="profile-main-card">
            <div className="profile-header-info">
                <div className="student-meta">
                <h1 className="student-name">{profile.full_name}</h1>
                <p className="student-sub">{profile.record_book}</p>
                <p className="student-sub">{profile.faculty} &nbsp; {profile.course} курс &nbsp; {profile.group}</p>
                </div>
                <div className="total-score">
                <span className="score-label">Общий балл</span>
                <span className="score-value">{profile.total_score}</span>
                </div>
            </div>

            <div className="profile-stats-grid">
                <div className="activity-list">
                <p className="section-subtitle">Распределение баллов по видам деятельности</p>
                {profile.radar_stats.labels.map((label: string, index: number) => (
                    <div key={label} className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                    <div className="activity-item">
                        <span className="dot blue"></span> {label} <span className="val">{profile.radar_stats.data[index]}</span>
                    </div>
                    </div>
                ))}
                </div>

              <div className="chart-container" style={{ position: 'relative', height: '300px' }}>
                <p className="section-subtitle">Диаграмма распределения баллов</p>
                <Radar data={data} options={options} />
              </div>
            </div>
            </div>

            <div className="achievements-section">
            {/* Подтвержденные */}
            {approvedDocs.length > 0 && (
                <div className="achievements-group confirmed">
                <div className="group-header">Подтвержденные достижения</div>
                {approvedDocs.map((doc: any) => (
                    <AchievementItem key={doc.id} doc={doc} />
                ))}
                </div>
            )}

            {/* В ожидании */}
            {isOwner && pendingDocs.length > 0 && (
                <div className="achievements-group pending">
                <div className="group-header">Ожидающие подтверждения</div>
                {pendingDocs.map((doc: any) => (
                    <AchievementItem key={doc.id} doc={doc} />
                ))}
                </div>
            )}

            {/* Отклоненные */}
            {isOwner && rejectedDocs.length > 0 && (
                <div className="achievements-group rejected">
                <div className="group-header">Отклоненные</div>
                {rejectedDocs.map((doc: any) => (
                    <div key={doc.id} className="doc-container-rejected">
                    <AchievementItem doc={doc} />
                    </div>
                ))}
                </div>
            )}
            </div>
            {isOwner && (
            <div className="flex" style={{ display: 'flex', justifyContent: 'center', marginTop: '30px' }}>
                <a href="/upload_achievement" className="add-achievement-btn">
                Загрузить новое достижение
                </a>
            </div>
            )}
        </div>
    </section>
    </>
    );
 }