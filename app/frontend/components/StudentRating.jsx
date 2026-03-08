'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';

export default function StudentRating() {
  const [activeTab, setActiveTab] = useState('common');
  const [students, setStudents] = useState([]);

  const [selectedFaculty, setSelectedFaculty] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');

  const scoreMap = {
    common: 'total_score',
    study: 'academic_score',
    social: 'social_score',
    sport: 'sport_score',
    science: 'research_score',
    culture: 'cultural_score',
  };

  useEffect(() => {
    api
      .get(`/user/api/v1/rating/`)
      .then((res) => setStudents(res.data))
      .catch((err) => console.error(err));
  }, []);

  const currentField = scoreMap[activeTab];

  const filteredByFaculty =
    selectedFaculty === 'all'
      ? students
      : students.filter((s) => s.faculty === selectedFaculty);

  const availableCourses = Array.from(
    new Set(
      filteredByFaculty
        .map((s) => s.course)
        .filter((v) => v !== null && v !== undefined),
    ),
  );

  const filteredByCourse =
    selectedCourse === 'all'
      ? filteredByFaculty
      : filteredByFaculty.filter((s) => String(s.course) === selectedCourse);

  const availableGroups = Array.from(
    new Set(filteredByCourse.map((s) => s.group).filter(Boolean)),
  );

  const filteredStudents =
    selectedGroup === 'all'
      ? filteredByCourse
      : filteredByCourse.filter((s) => s.group === selectedGroup);

  const faculties = Array.from(
    new Set(students.map((s) => s.faculty).filter(Boolean)),
  );

  const ratingData = [...filteredStudents]
    .sort((a, b) => (b[currentField] || 0) - (a[currentField] || 0))
    .map((student, index) => ({
      rank: index + 1,
      user_id: student.user_id,
      name: student.full_name,
      score: student[currentField],
      faculty: student.faculty,
      course: student.course,
      group: student.group,
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
      <div className="tabs-navigation">
        <div className="container">
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

                  {/* Факультет */}
                  <th>
                    <div className="filter-item">
                      <label htmlFor="faculty-select">Факультет<span> </span></label>
                      <select
                        id="faculty-select"
                        value={selectedFaculty}
                        onChange={(e) => {
                          setSelectedFaculty(e.target.value);
                          setSelectedCourse('all');
                          setSelectedGroup('all');
                        }}
                      >
                        <option value="all">Все</option>
                        {faculties.map((faculty) => (
                          <option key={faculty} value={faculty}>
                            {faculty}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>

                  {/* Курс */}
                  <th>
                    <div className="filter-item">
                      <label htmlFor="course-select">Курс<span> </span></label>
                      <select
                        id="course-select"
                        value={selectedCourse}
                        onChange={(e) => {
                          setSelectedCourse(e.target.value);
                          setSelectedGroup('all');
                        }}
                        disabled={availableCourses.length === 0}
                      >
                        <option value="all">Все</option>
                        {availableCourses
                          .slice()
                          .sort((a, b) => a - b)
                          .map((course) => (
                            <option key={course} value={String(course)}>
                              {course}
                            </option>
                          ))}
                      </select>
                    </div>
                  </th>

                  {/* Группа */}
                  <th>
                    <div className="filter-item">
                      <label htmlFor="group-select">Группа<span> </span></label>
                      <select
                        id="group-select"
                        value={selectedGroup}
                        onChange={(e) => setSelectedGroup(e.target.value)}
                        disabled={availableGroups.length === 0}
                      >
                        <option value="all">Все</option>
                        {availableGroups
                          .slice()
                          .sort((a, b) => a.localeCompare(b))
                          .map((group) => (
                            <option key={group} value={group}>
                              {group}
                            </option>
                          ))}
                      </select>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ratingData.map((student, index) => (
                  <tr key={index} className="table-row-card">
                    <td>
                      <div className="rank-circle-blue">{student.rank}</div>
                    </td>
                    {/* <td className="student-name-cell">
                      <a href={`/profile/${student.user_id}`}>{student.name}</a>
                    </td> */}
                    <td className="student-name-cell">
                      {student.name}
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