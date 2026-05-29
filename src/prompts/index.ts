import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPrompts(server: McpServer): void {
  server.prompt(
    'daily_standup',
    'Generate a daily standup report for a project sprint',
    {
      project_slug: z.string().describe('Project slug'),
      sprint_name: z.string().optional().describe('Sprint name (omit to use current sprint)'),
    },
    ({ project_slug, sprint_name }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Tạo báo cáo standup hàng ngày cho project "${project_slug}"${sprint_name ? `, sprint "${sprint_name}"` : ' (sprint hiện tại)'}.

Các bước:
1. Gọi taiga_list_projects → tìm project có slug "${project_slug}"
2. Gọi taiga_list_sprints với project_id → tìm sprint đang active (closed=false)
3. Gọi taiga_list_userstories lọc theo sprint → danh sách US theo member
4. Gọi taiga_list_tasks lọc theo sprint → tasks theo từng member
5. Gọi taiga_get_project_timeline → xem activities 24h qua
6. Tổng hợp theo format:

**Daily Standup — [ngày hôm nay]**
**Sprint:** [tên sprint]

Cho mỗi member:
- **[Tên member]:**
  - Hôm qua: [các items đã done]
  - Hôm nay: [các items đang làm]
  - Blockers: [nếu có]`,
          },
        },
      ],
    }),
  );

  server.prompt(
    'sprint_review',
    'Generate a sprint review report with velocity and completion analysis',
    {
      project_slug: z.string().describe('Project slug'),
      sprint_id: z.number().describe('Sprint ID to review'),
    },
    ({ project_slug, sprint_id }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Tạo báo cáo Sprint Review cho project "${project_slug}", sprint ID ${sprint_id}.

Các bước:
1. Gọi taiga_get_sprint với sprint_id=${sprint_id}
2. Gọi taiga_get_sprint_stats với sprint_id=${sprint_id} → burndown data
3. Gọi taiga_list_userstories lọc theo sprint → phân loại done/undone
4. Gọi taiga_list_issues lọc theo sprint (nếu có)
5. Tổng hợp báo cáo:

**Sprint Review — [tên sprint]**
- Thời gian: [start] → [end]
- Story Points: Đã hoàn thành / Tổng (velocity)
- User Stories: [done] / [total]
- Tasks: [done] / [total]
- **Done:** [danh sách US hoàn thành]
- **Undone:** [danh sách US chưa xong]
- **Nhận xét:** [phân tích và bài học]`,
          },
        },
      ],
    }),
  );

  server.prompt(
    'sprint_planning',
    'Assist with sprint planning by analysing the backlog and team capacity',
    {
      project_slug: z.string().describe('Project slug'),
    },
    ({ project_slug }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Hỗ trợ lập kế hoạch sprint cho project "${project_slug}".

Các bước:
1. Gọi taiga_get_project với slug="${project_slug}" → lấy project info
2. Gọi taiga_list_userstories với milestone__isnull=true → backlog hiện tại
3. Gọi taiga_list_members → danh sách team
4. Gọi taiga_list_sprints (closed=false) → sprint hiện tại nếu có
5. Phân tích:
   - Backlog priority (dựa trên thứ tự)
   - Story points của từng US
   - Capacity team (avg velocity từ sprints trước nếu có)
6. Đề xuất:
   - Các US nên đưa vào sprint tiếp theo
   - Phân công dựa trên skill/workload
   - Mục tiêu sprint points`,
          },
        },
      ],
    }),
  );

  server.prompt(
    'project_health_check',
    'Evaluate project health: overdue items, blocked stories, unassigned issues',
    {
      project_slug: z.string().describe('Project slug'),
    },
    ({ project_slug }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Đánh giá sức khoẻ dự án cho project "${project_slug}".

Các bước:
1. Gọi taiga_get_project với slug="${project_slug}"
2. Gọi taiga_get_project_stats → tổng quan
3. Gọi taiga_list_sprints (closed=false) → sprint đang chạy
4. Gọi taiga_list_userstories lọc sprint hiện tại → tìm US bị blocked
5. Gọi taiga_list_issues → issues chưa assigned hoặc priority cao
6. Gọi taiga_get_project_timeline → hoạt động gần đây
7. Báo cáo:

**Project Health Check — "${project_slug}"**
🟢 **Điểm mạnh:** [những gì đang tốt]
🟡 **Cần chú ý:** [rủi ro tiềm tàng]
🔴 **Vấn đề nghiêm trọng:** [cần hành động ngay]
📋 **Khuyến nghị:** [action items cụ thể]`,
          },
        },
      ],
    }),
  );

  server.prompt(
    'team_workload',
    'Analyse team workload distribution across stories and tasks',
    {
      project_slug: z.string().describe('Project slug'),
      sprint_id: z.number().optional().describe('Sprint ID (omit for current sprint)'),
    },
    ({ project_slug, sprint_id }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Phân tích phân bổ công việc trong team cho project "${project_slug}"${sprint_id ? `, sprint ${sprint_id}` : ' (sprint hiện tại)'}.

Các bước:
1. Gọi taiga_list_members → danh sách team
2. Gọi taiga_list_userstories (lọc theo sprint) → group by assigned_to
3. Gọi taiga_list_tasks (lọc theo sprint) → group by assigned_to
4. Tính:
   - Số US + tasks per person
   - Story points per person (nếu có)
   - % completion per person
5. Báo cáo:

**Team Workload — [sprint name]**
| Member | US | Tasks | Points | Done% |
|--------|----|-------|--------|-------|
[dữ liệu từng member]

**Nhận xét:** [ai đang overload, ai còn capacity]
**Đề xuất:** [cân bằng lại workload]`,
          },
        },
      ],
    }),
  );

  server.prompt(
    'issue_triage',
    'Triage and prioritise open issues, suggest assignments based on team',
    {
      project_slug: z.string().describe('Project slug'),
    },
    ({ project_slug }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Phân loại và ưu tiên hóa issues cho project "${project_slug}".

Các bước:
1. Gọi taiga_get_project với slug="${project_slug}"
2. Gọi taiga_list_issue_statuses → lấy ID trạng thái "mới/chưa xử lý"
3. Gọi taiga_list_issues → lọc issues chưa assigned hoặc status mới
4. Gọi taiga_list_priorities → bảng priority
5. Gọi taiga_list_severities → bảng severity
6. Gọi taiga_list_members → danh sách team
7. Phân loại issues:
   - 🔴 Critical/High: cần xử lý ngay
   - 🟡 Medium: sprint tiếp theo
   - 🟢 Low: backlog
8. Đề xuất assign cho từng member dựa trên:
   - Loại issue (backend/frontend/mobile)
   - Workload hiện tại
   - Expertise`,
          },
        },
      ],
    }),
  );
}
