// 예시 친구 데이터예요. (진짜 학생 정보가 아니에요!)
// 학교 앱에 데이터베이스가 연결되면, 이 파일 대신 진짜 친구 정보를 불러오게 바꿀 거예요.
//
// studying: 지금 공부 중이면 { 과목, 몇 분 전에 시작했는지 }, 쉬는 중이면 null
// todaySeconds: 오늘 공부한 시간(초) / totalSeconds: 전체 누적 시간(초)

export const exampleFriends = [
  {
    id: "f1",
    name: "새벽 부엉이",
    avatar: "🦉",
    studying: { subject: "수학", minutesAgo: 42 },
    todaySeconds: 3 * 3600 + 20 * 60,
    totalSeconds: 58 * 3600 + 10 * 60,
  },
  {
    id: "f2",
    name: "공부왕 토끼",
    avatar: "🐰",
    studying: { subject: "영어", minutesAgo: 15 },
    todaySeconds: 2 * 3600 + 5 * 60,
    totalSeconds: 71 * 3600 + 30 * 60,
  },
  {
    id: "f3",
    name: "수학 다람쥐",
    avatar: "🐿️",
    studying: null,
    todaySeconds: 50 * 60,
    totalSeconds: 23 * 3600,
  },
  {
    id: "f4",
    name: "과학 펭귄",
    avatar: "🐧",
    studying: null,
    todaySeconds: 0,
    totalSeconds: 12 * 3600 + 40 * 60,
  },
];