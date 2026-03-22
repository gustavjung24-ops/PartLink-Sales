import { useState } from "react";

const PROGRESS_KEY = "sparelink:trainingProgress";

interface Module {
  id: string;
  title: string;
  description: string;
  durationMin: number;
  tags: string[];
  content: string;
  quiz: { question: string; options: string[]; answer: number }[];
}

const MODULES: Module[] = [
  {
    id: "m1",
    title: "Giới thiệu hệ thống SPARELINK",
    description: "Tổng quan về sản phẩm, kiến trúc 3 tầng và quy trình làm việc.",
    durationMin: 10,
    tags: ["cơ bản", "hệ thống"],
    content: `SPARELINK là nền tảng tra cứu phụ tùng công nghiệp thông minh được thiết kế cho đội ngũ kinh doanh.

Các tính năng chính:
• Tìm kiếm mã phụ tùng tức thì từ kho nội bộ và nhà cung cấp đối tác
• Gợi ý hàng thay thế bằng AI (yêu cầu phê duyệt cấp trên)
• Tạo báo giá nhanh và xuất file
• Đồng bộ offline — làm việc ngay cả khi mất kết nối mạng

Kiến trúc 3 tầng:
  Cloud API  ←→  Desktop App  ←→  Người dùng
               (Windows/macOS)`,
    quiz: [
      {
        question: "SPARELINK xử lý kết nối như thế nào khi mất mạng?",
        options: ["Hiển thị lỗi và dừng", "Đồng bộ offline — lưu hành động vào queue", "Tự động tắt ứng dụng"],
        answer: 1,
      },
      {
        question: "Gợi ý hàng thay thế AI có cần phê duyệt không?",
        options: ["Không, dùng ngay", "Có, cần phê duyệt cấp trên", "Chỉ cần SENIOR_SALES"],
        answer: 1,
      },
    ],
  },
  {
    id: "m2",
    title: "Tra cứu và chuyển đổi mã phụ tùng",
    description: "Cách tìm kiếm hiệu quả, đọc kết quả và sử dụng bộ lọc.",
    durationMin: 15,
    tags: ["tra cứu", "kỹ năng"],
    content: `Màn hình Tra cứu là trung tâm của SPARELINK.

Mã phụ tùng chuẩn: PREFIX-XXXX (ví dụ: BRG-1234, HYD-5678)
• BRG = ổ lăng (bearing)
• HYD = thủy lực (hydraulic)
• ELT = điện (electrical)
• MCH = cơ khí (mechanical)

Kết quả được nhóm theo 3 nguồn:
  🟢 Công ty sẵn có — tồn kho trực tiếp, xác nhận cao nhất
  🔵 Hàng thay thế nội bộ — đã kiểm duyệt, có thể đặt hàng
  🟠 Gợi ý AI bên ngoài — cần phê duyệt trước khi báo giá

Mỗi kết quả hiển thị thanh "độ tin cậy" từ 0–100%.
Chỉ dùng kết quả AI khi không tìm thấy hàng 🟢🔵.`,
    quiz: [
      {
        question: "Màu nào đại diện cho phụ tùng tồn kho trực tiếp của công ty?",
        options: ["🟠 Cam", "🔵 Xanh dương", "🟢 Xanh lá"],
        answer: 2,
      },
      {
        question: "Prefix 'HYD' đại diện cho loại phụ tùng nào?",
        options: ["Điện", "Thủy lực", "Ổ lăng"],
        answer: 1,
      },
    ],
  },
  {
    id: "m3",
    title: "Tạo và gửi báo giá",
    description: "Thêm mặt hàng vào báo giá, chỉnh giá, xuất file và theo dõi trạng thái.",
    durationMin: 20,
    tags: ["báo giá", "kỹ năng"],
    content: `Quy trình tạo báo giá:

1. Từ kết quả tìm kiếm → nhấn "Thêm vào báo giá"
2. Tới màn hình Báo giá, điền thông tin khách hàng
3. Chỉnh số lượng và giá cho từng dòng
4. Xem trước văn bản và sao chép vào email/Zalo
5. Hoặc dùng Ctrl+P để in/lưu PDF

Trạng thái báo giá:
  draft → sent → approved / rejected
  (báo giá đã "approved" sẽ tự tạo đơn hàng)

Lưu ý: Nhân viên USER chỉ xem — cần role SALES trở lên để tạo báo giá.`,
    quiz: [
      {
        question: "Role tối thiểu để tạo báo giá là gì?",
        options: ["USER", "SALES", "ADMIN"],
        answer: 1,
      },
      {
        question: "Làm cách nào để lưu báo giá ra file PDF?",
        options: ["Nhấn nút Export PDF chuyên dụng", "Dùng Ctrl+P rồi chọn Lưu PDF", "Gửi mail rồi tải về"],
        answer: 1,
      },
    ],
  },
];

type ProgressMap = Record<string, "not_started" | "in_progress" | "completed">;
type QuizState = Record<string, { selected: number | null; submitted: boolean }>;

function loadProgress(): ProgressMap {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}") as ProgressMap;
  } catch {
    return {};
  }
}

function saveProgress(p: ProgressMap) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "Chưa học",
  in_progress: "Đang học",
  completed: "Hoàn thành",
};
const STATUS_COLOR: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

export function TrainingScreen(): JSX.Element {
  const [progress, setProgress] = useState<ProgressMap>(loadProgress);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [quizState, setQuizState] = useState<QuizState>({});

  const activeModule = MODULES.find((m) => m.id === activeId) ?? null;
  const completedCount = MODULES.filter((m) => progress[m.id] === "completed").length;

  const open = (id: string) => {
    setActiveId(id);
    setProgress((p) => {
      const next: ProgressMap = { ...p, [id]: p[id] === "completed" ? "completed" : "in_progress" };
      saveProgress(next);
      return next;
    });
  };

  const markComplete = (id: string) => {
    setProgress((p) => {
      const next: ProgressMap = { ...p, [id]: "completed" };
      saveProgress(next);
      return next;
    });
    setActiveId(null);
  };

  const selectQuizAnswer = (moduleId: string, qIdx: number, optIdx: number) => {
    const key = `${moduleId}-${qIdx}`;
    if (quizState[key]?.submitted) return;
    setQuizState((prev) => ({ ...prev, [key]: { selected: optIdx, submitted: false } }));
  };

  const submitQuiz = (moduleId: string, qIdx: number) => {
    const key = `${moduleId}-${qIdx}`;
    setQuizState((prev) => ({ ...prev, [key]: { ...prev[key], submitted: true } }));
  };

  if (activeModule) {
    const allQuizzesCorrect = activeModule.quiz.every((q, qi) => {
      const state = quizState[`${activeModule.id}-${qi}`];
      return state?.submitted && state.selected === q.answer;
    });
    const allSubmitted = activeModule.quiz.every((_, qi) => quizState[`${activeModule.id}-${qi}`]?.submitted);

    return (
      <section className="mx-auto max-w-2xl space-y-6">
        <button
          type="button"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-sky-600"
          onClick={() => setActiveId(null)}
        >
          ← Quay lại danh sách
        </button>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-1 flex flex-wrap gap-2">
            {activeModule.tags.map((t) => (
              <span key={t} className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">{t}</span>
            ))}
          </div>
          <h2 className="text-lg font-semibold">{activeModule.title}</h2>
          <p className="mt-1 text-sm text-slate-500">⏱ {activeModule.durationMin} phút</p>

          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 font-sans text-sm leading-relaxed dark:bg-slate-950/50">
            {activeModule.content}
          </pre>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">Câu hỏi kiểm tra</h3>
          {activeModule.quiz.map((q, qi) => {
            const stateKey = `${activeModule.id}-${qi}`;
            const qs = quizState[stateKey];
            return (
              <div key={qi} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm font-medium">{qi + 1}. {q.question}</p>
                <ul className="mt-3 space-y-2">
                  {q.options.map((opt, oi) => {
                    const isSelected = qs?.selected === oi;
                    const isSubmitted = qs?.submitted;
                    const isCorrect = oi === q.answer;
                    let cls = "cursor-pointer rounded-lg border px-4 py-2 text-sm transition-colors ";
                    if (!isSubmitted) {
                      cls += isSelected ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-900/30" : "border-slate-200 hover:border-slate-400 dark:border-slate-700";
                    } else if (isCorrect) {
                      cls += "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
                    } else if (isSelected && !isCorrect) {
                      cls += "border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
                    } else {
                      cls += "border-slate-200 text-slate-400 dark:border-slate-700";
                    }
                    return (
                      <li key={oi} className={cls} role="button" onClick={() => selectQuizAnswer(activeModule.id, qi, oi)}>
                        {opt}
                      </li>
                    );
                  })}
                </ul>
                {!qs?.submitted && qs?.selected != null && (
                  <button
                    type="button"
                    className="mt-3 rounded-md bg-sky-600 px-4 py-1.5 text-xs text-white hover:bg-sky-700"
                    onClick={() => submitQuiz(activeModule.id, qi)}
                  >
                    Nộp đáp án
                  </button>
                )}
                {qs?.submitted && (
                  <p className={`mt-2 text-xs font-medium ${qs.selected === q.answer ? "text-emerald-600" : "text-rose-600"}`}>
                    {qs.selected === q.answer ? "✓ Đúng!" : `✗ Sai. Đáp án đúng: "${q.options[q.answer]}"`}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {allSubmitted && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
            {allQuizzesCorrect ? (
              <>
                <p className="font-semibold text-emerald-700 dark:text-emerald-300">🎉 Xuất sắc! Bạn đã trả lời đúng tất cả câu hỏi.</p>
                {progress[activeModule.id] !== "completed" && (
                  <button
                    type="button"
                    className="mt-3 rounded-md bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-700"
                    onClick={() => markComplete(activeModule.id)}
                  >
                    Đánh dấu hoàn thành
                  </button>
                )}
              </>
            ) : (
              <p className="text-amber-700 dark:text-amber-300">⚠ Bạn có một số câu trả lời sai. Hãy đọc lại nội dung và thử lại.</p>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Đào tạo</h1>
        <span className="text-sm text-slate-500">{completedCount} / {MODULES.length} mô-đun hoàn thành</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-2 rounded-full bg-emerald-500 transition-all"
          style={{ width: `${Math.round((completedCount / MODULES.length) * 100)}%` }}
        />
      </div>

      <ul className="space-y-4">
        {MODULES.map((m) => {
          const status = progress[m.id] ?? "not_started";
          return (
            <li
              key={m.id}
              className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              role="button"
              onClick={() => open(m.id)}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">{m.title}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{m.description}</p>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {m.tags.map((t) => (
                    <span key={t} className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">{t}</span>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-slate-400">⏱ {m.durationMin} phút</p>
                {status === "completed" && <span className="text-emerald-500">✓</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
