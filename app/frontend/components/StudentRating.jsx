'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';

export default function StudentRating() {
  const [activeTab, setActiveTab] = useState('common');
  const [students, setStudents] = useState([]);

  const scoreMap = {
    common: 'total_score',
    study: 'academic_score',
    social: 'social_score',
    sport: 'sport_score',
    science: 'research_score',
    culture: 'cultural_score',
  };

  useEffect(() => {
    api.get(`/user/api/v1/rating/`) 
      .then((res) => setStudents(res.data))
      .catch((err) => console.error(err));
  }, []);

  const currentField = scoreMap[activeTab];
  
  const ratingData = [...students]
    .sort((a, b) => (b[currentField] || 0) - (a[currentField] || 0))
    .map((student, index) => ({
      rank: index + 1,
      user_id: student.user_id,
      name: student.full_name,
      score: student[currentField],
      faculty: student.faculty,
      course: student.course,
      group: student.group
    }));

  const tabs = [
    { id: 'common', label: 'Общий рейтинг' },
    { id: 'study', label: 'Учебная деятельность' },
    { id: 'social', label: 'Общественная деятельность' },
    { id: 'sport', label: 'Спортивная деятельность' },
    { id: 'science', label: 'Научно-исследовательская деятельность' },
    { id: 'culture', label: 'Культурно-творческая деятельность' },
  ];

  return (
    <div className="rating-page">
      {/* Блок кнопок-вкладок над таблицей */}
      <div className="tabs-navigation">
        <div className="container"> {/* Добавляем этот контейнер */}
          <div className="tabs-container">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="rating-section">
        <div className="container">
          <div className="table-container-modern">
            <table className="clean-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}></th>
                  <th style={{ textAlign: 'left' }}>ФИО Студента</th>
                  <th>Баллы</th>
                  <th>Факультет</th>
                  <th>Курс</th>
                  <th>Группа</th>
                </tr>
              </thead>
              <tbody>
                {ratingData.map((student, index) => (
                  <tr key={index} className="table-row-card">
                    <td>
                      <div className="rank-circle-blue">{student.rank}</div>
                    </td>
                    <td className="student-name-cell">
                      <a href={`/profile/${student.user_id}`}>
                        {student.name}
                      </a>
                    </td>
                    <td className="student-score-blue">{student.score}</td>
                    <td>{student.faculty}</td>
                    <td>{student.course}</td>
                    <td>{student.group}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}