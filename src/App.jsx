import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Map, CheckSquare, BrainCircuit, Calendar, 
  Terminal, Cpu, AlertCircle, Check, ChevronRight, PenTool, Plus, Trash2,
  ChevronDown, ChevronUp, Code, Zap, Copy, ThumbsUp, ThumbsDown, X,
  ArrowLeft, List, FlaskConical, Eye, EyeOff, Bug
} from 'lucide-react';

// --- DATA DEFINITIONS ---

const ROADMAP = [
  {
    id: 1,
    phase: "Giai đoạn 1",
    weeks: "Tuần 1–2",
    title: "Nền tảng (Foundations)",
    desc: "Khái niệm RTOS: tasks (tác vụ), scheduler (bộ lập lịch), preemption (chiếm quyền). Chớp nháy LED với 2 tasks. So sánh tư duy lập trình bare-metal với RTOS.",
    color: "bg-blue-500",
    details: [
      {
        topic: "1. Vòng lặp Task & Hàm vTaskDelay",
        content: "Trong FreeRTOS, một Task thường là một vòng lặp vô tận `for(;;)` hoặc `while(1)`. Bên trong vòng lặp, Task thực hiện công việc rồi gọi `vTaskDelay()` để tự nguyện nhường CPU.\n\nKhác với lập trình Bare-metal dùng `delay()` sẽ treo toàn bộ CPU (busy-wait), `vTaskDelay()` đưa Task vào trạng thái Blocked, cho phép Scheduler chuyển CPU sang Task khác ngay lập tức. Khi hết thời gian chờ, Task tự động quay lại trạng thái Ready.\n\n*Lưu ý: Phần code khởi tạo (trước vòng lặp) chỉ chạy đúng 1 lần khi Task được tạo.*",
        code: `void vTaskBlink(void *pvParameters) {
    // === PHẦN KHỞI TẠO (chạy 1 lần duy nhất) ===
    pinMode(LED_PIN, OUTPUT);
    
    // === VÒNG LẶP VÔ TẬN CỦA TASK ===
    for(;;) {
        digitalWrite(LED_PIN, HIGH);
        
        // Nhường CPU trong 500ms, Task vào trạng thái Blocked
        vTaskDelay(pdMS_TO_TICKS(500)); 
        
        digitalWrite(LED_PIN, LOW);
        vTaskDelay(pdMS_TO_TICKS(500));
        
        // Sau mỗi vTaskDelay, Task trở lại Ready -> Running khi đến lượt
    }
    
    // Code ở đây KHÔNG BAO GIỜ được thực thi (vòng lặp vô tận)
    // Nếu Task cần kết thúc, hãy dùng vTaskDelete(NULL);
}`
      },
      {
        topic: "2. Khởi tạo Task với xTaskCreate",
        content: "Để Scheduler quản lý được Task, bạn phải đăng ký nó bằng `xTaskCreate()`. Hàm này sẽ:\n- Cấp phát bộ nhớ (RAM) cho Stack của Task.\n- Tạo khối điều khiển TCB (Task Control Block) chứa thông tin quản lý.\n- Đưa Task vào trạng thái Ready, sẵn sàng để Scheduler gọi chạy.\n\nHàm trả về `pdPASS` nếu thành công, hoặc `errCOULD_NOT_ALLOCATE_REQUIRED_MEMORY` nếu không đủ RAM.\n\n*Lưu ý: Trên ESP32, Stack tính bằng Bytes. Trên STM32 (ARM Cortex-M), Stack tính bằng Words (1 word = 4 bytes).*",
        code: `// Khai báo biến Task Handle để quản lý Task sau này
TaskHandle_t xBlinkTaskHandle = NULL;

void app_main(void) {
    // Tạo Task và lưu Handle
    BaseType_t xResult = xTaskCreate(
        vTaskBlink,           /* Con trỏ tới hàm thực thi của Task */
        "BlinkTask",          /* Tên Task (chuỗi, dùng để debug) */
        2048,                 /* Kích thước Stack (Bytes trên ESP32) */
        NULL,                 /* Tham số truyền vào Task (pvParameters) */
        1,                    /* Mức ưu tiên (Priority) - Số càng lớn, ưu tiên càng cao */
        &xBlinkTaskHandle     /* Con trỏ nhận Task Handle (có thể NULL nếu không cần) */
    );
    
    // Luôn kiểm tra kết quả tạo Task!
    if (xResult != pdPASS) {
        printf("LOI: Khong du RAM de tao Task!\\n");
    }
    
    // Trên STM32, cần gọi thêm dòng này để bắt đầu chạy Scheduler:
    // vTaskStartScheduler();
    // Trên ESP32 (ESP-IDF), Scheduler đã tự động chạy sẵn.
}`
      },
      {
        topic: "3. Vòng đời và Trạng thái của Task",
        content: "Một Task trong FreeRTOS luôn nằm ở 1 trong 4 trạng thái:\n\n- **Running**: Đang thực sự chiếm giữ CPU và thực thi code. Tại bất kỳ thời điểm nào, chỉ có DUY NHẤT 1 Task ở trạng thái này (trên mỗi core).\n- **Ready**: Đã sẵn sàng chạy, nhưng đang chờ tới lượt vì có Task ưu tiên cao hơn (hoặc ngang bằng) đang Running.\n- **Blocked**: Đang chờ một sự kiện xảy ra (hết delay, có dữ liệu từ Queue, Semaphore được Give...). Task Blocked KHÔNG tiêu tốn CPU.\n- **Suspended**: Bị đình chỉ hoàn toàn bằng `vTaskSuspend()`. Scheduler sẽ bỏ qua nó cho đến khi được gọi `vTaskResume()`.\n\nSơ đồ chuyển trạng thái:\n`[Ready] --(Scheduler chọn)--> [Running]`\n`[Running] --(vTaskDelay/xQueueReceive...)--> [Blocked]`\n`[Running] --(vTaskSuspend)--> [Suspended]`\n`[Blocked] --(Hết timeout/Có sự kiện)--> [Ready]`\n`[Suspended] --(vTaskResume)--> [Ready]`",
      },
      {
        topic: "4. Scheduler & Mức ưu tiên (Priority)",
        content: "Scheduler (Bộ lập lịch) là trái tim của FreeRTOS. Nó quyết định Task nào được chạy tại mỗi thời điểm dựa trên nguyên tắc:\n\n**\"Task có mức ưu tiên cao nhất và đang ở trạng thái Ready sẽ được chạy.\"**\n\n- Mức ưu tiên từ 0 (thấp nhất, dành cho Idle Task) đến `configMAX_PRIORITIES - 1` (cao nhất).\n- **Preemption (Chiếm quyền)**: Nếu một Task ưu tiên cao hơn chuyển sang Ready (ví dụ: hết delay), Scheduler sẽ LẬP TỨC dừng Task hiện tại và chuyển sang Task ưu tiên cao hơn.\n- **Time Slicing**: Nếu nhiều Task có CÙNG mức ưu tiên, Scheduler sẽ luân phiên cho mỗi Task chạy 1 tick (Round-Robin).\n- **Idle Task**: FreeRTOS tự tạo 1 Task ở priority 0. Nó chạy khi không có Task nào khác cần CPU (dọn dẹp bộ nhớ, tiết kiệm năng lượng...).\n\n*Mẹo thực tế: Không nên tạo quá nhiều mức ưu tiên. Trong đa số dự án, 3-5 mức là đủ.*",
        code: `// Ví dụ: Hệ thống với 3 mức ưu tiên
#define PRIORITY_LOW    1   // Task nền (logging, LED status)
#define PRIORITY_MED    3   // Task xử lý chính (đọc cảm biến)
#define PRIORITY_HIGH   5   // Task thời gian thực (điều khiển motor, safety)

void app_main(void) {
    // Task LED: ưu tiên THẤP - bị chiếm quyền bất cứ lúc nào
    xTaskCreate(vTaskLED,    "LED",    2048, NULL, PRIORITY_LOW,  NULL);
    
    // Task Sensor: ưu tiên TRUNG BÌNH
    xTaskCreate(vTaskSensor, "Sensor", 4096, NULL, PRIORITY_MED,  NULL);
    
    // Task Motor: ưu tiên CAO - luôn được ưu tiên chạy trước
    xTaskCreate(vTaskMotor,  "Motor",  4096, NULL, PRIORITY_HIGH, NULL);
    
    // Khi Task Motor đang Blocked (chờ dữ liệu), Task Sensor chạy.
    // Khi cả Motor và Sensor đều Blocked, Task LED mới được chạy.
}`
      },
      {
        topic: "5. Định thời chính xác với vTaskDelayUntil",
        content: "Vấn đề: `vTaskDelay(100)` nghĩa là 'ngủ 100 ticks KỂ TỪ LÚC GỌI'. Nếu code trước đó mất 20 ticks, chu kỳ thực sự là 120 ticks (sai lệch tích lũy theo thời gian).\n\nGiải pháp: `vTaskDelayUntil()` đảm bảo Task chạy với chu kỳ TUYỆT ĐỐI cố định, bất kể thời gian thực thi code bên trong.\n\n- Dùng `vTaskDelay()` khi: Thời gian không quan trọng lắm (chớp LED, in log).\n- Dùng `vTaskDelayUntil()` khi: Cần chu kỳ chính xác (đọc cảm biến, điều khiển PID, truyền thông định kỳ).\n\n*Lưu ý: Trong ESP-IDF mới, hàm này được đổi tên thành `xTaskDelayUntil()` và trả về giá trị `pdTRUE/pdFALSE`.*",
        code: `void vTaskReadSensor(void *pvParameters) {
    // Lưu thời điểm bắt đầu hiện tại
    TickType_t xLastWakeTime = xTaskGetTickCount();
    
    // Chu kỳ mong muốn: chính xác 50ms
    const TickType_t xPeriod = pdMS_TO_TICKS(50);
    
    for(;;) {
        // === Đọc cảm biến (giả sử mất 5-15ms tùy lần) ===
        int sensorValue = readADC();
        processData(sensorValue);
        
        // Dùng vTaskDelayUntil: Luôn đảm bảo chu kỳ đúng 50ms
        // Dù code trên mất 5ms hay 15ms, Task vẫn thức dậy đúng nhịp
        vTaskDelayUntil(&xLastWakeTime, xPeriod);
        
        // So sánh với vTaskDelay(pdMS_TO_TICKS(50)):
        // -> Nếu code mất 15ms, chu kỳ thực sự = 15 + 50 = 65ms (SAI!)
        // -> vTaskDelayUntil giữ chu kỳ luôn = 50ms (ĐÚNG!)
    }
}`
      },
      {
        topic: "6. Quản lý Task: Delete, Suspend & Resume",
        content: "Sau khi tạo Task, bạn có thể điều khiển vòng đời của nó thông qua Task Handle:\n\n- **`vTaskDelete(handle)`**: Xóa Task vĩnh viễn, giải phóng RAM. Truyền `NULL` để Task tự xóa chính nó.\n- **`vTaskSuspend(handle)`**: Đình chỉ Task (chuyển sang trạng thái Suspended). Task không chạy cho đến khi được Resume.\n- **`vTaskResume(handle)`**: Đánh thức Task đã bị Suspend, đưa về trạng thái Ready.\n\n*Cảnh báo: Nếu xóa một Task đang giữ Mutex, Mutex sẽ KHÔNG được tự động giải phóng -> gây Deadlock! Luôn đảm bảo Task trả Mutex trước khi bị xóa.*\n\n*Lưu ý: `vTaskDelete()` chỉ hoạt động khi `INCLUDE_vTaskDelete` được set = 1 trong `FreeRTOSConfig.h`.*",
        code: `TaskHandle_t xSensorTaskHandle = NULL;

void vTaskSensor(void *pvParameters) {
    for(;;) {
        int value = readSensor();
        printf("Gia tri: %d\\n", value);
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

void vTaskController(void *pvParameters) {
    for(;;) {
        char cmd = getCommand();
        
        switch(cmd) {
            case 'S': // Stop sensor
                if (xSensorTaskHandle != NULL) {
                    vTaskSuspend(xSensorTaskHandle);
                    printf("Sensor Task da bi DINH CHI\\n");
                }
                break;
                
            case 'R': // Resume sensor
                if (xSensorTaskHandle != NULL) {
                    vTaskResume(xSensorTaskHandle);
                    printf("Sensor Task da HOAT DONG lai\\n");
                }
                break;
                
            case 'D': // Delete sensor permanently
                if (xSensorTaskHandle != NULL) {
                    vTaskDelete(xSensorTaskHandle);
                    xSensorTaskHandle = NULL; // Đặt NULL để tránh dùng Handle đã xóa
                    printf("Sensor Task da bi XOA vinh vien\\n");
                }
                break;
        }
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}`
      },
      {
        topic: "7. So sánh tư duy: Bare-metal vs RTOS",
        content: "Sự khác biệt cốt lõi giữa lập trình Bare-metal và RTOS không chỉ ở API, mà ở TƯ DUY thiết kế:\n\n**Bare-metal (Super Loop):**\n- Tất cả logic chạy trong 1 vòng lặp `while(1)` duy nhất.\n- Thứ tự thực thi cố định, tuần tự từ trên xuống dưới.\n- Delay = CPU bị treo, không làm gì cả (busy-wait).\n- Khi thêm tính năng mới -> code phình to, khó bảo trì.\n\n**RTOS (Multi-tasking):**\n- Mỗi tính năng là 1 Task độc lập, có Stack riêng.\n- Scheduler tự động phân chia CPU theo ưu tiên.\n- Delay = nhường CPU cho Task khác (không lãng phí).\n- Thêm tính năng = tạo thêm Task, không ảnh hưởng code cũ.\n\n*Quy tắc vàng: Nếu hệ thống của bạn có > 3 tác vụ cần chạy \"đồng thời\" với yêu cầu thời gian khác nhau, hãy cân nhắc dùng RTOS.*",
        code: `// ===== CÁCH 1: BARE-METAL (Super Loop) =====
// Vấn đề: Nếu readSensor() mất 200ms, LED sẽ bị delay thêm 200ms!
void main_baremental(void) {
    while(1) {
        // Tác vụ 1: Chớp LED
        toggleLED();
        delay_ms(500);       // CPU bị treo 500ms, không làm gì khác!
        
        // Tác vụ 2: Đọc cảm biến
        readSensor();        // Nếu hàm này chậm -> LED bị ảnh hưởng
        delay_ms(100);
        
        // Tác vụ 3: Gửi dữ liệu
        sendData();          // Tất cả phụ thuộc lẫn nhau!
    }
}

// ===== CÁCH 2: FREERTOS (Multi-tasking) =====
// Giải pháp: Mỗi tác vụ HOÀN TOÀN ĐỘC LẬP, không ảnh hưởng nhau
void vTaskBlink(void *p)  { for(;;) { toggleLED();  vTaskDelay(pdMS_TO_TICKS(500)); } }
void vTaskSensor(void *p) { for(;;) { readSensor(); vTaskDelay(pdMS_TO_TICKS(100)); } }
void vTaskComm(void *p)   { for(;;) { sendData();   vTaskDelay(pdMS_TO_TICKS(1000)); } }

void app_main(void) {
    xTaskCreate(vTaskBlink,  "Blink",  2048, NULL, 1, NULL);
    xTaskCreate(vTaskSensor, "Sensor", 4096, NULL, 2, NULL);  // Ưu tiên cao hơn LED
    xTaskCreate(vTaskComm,   "Comm",   4096, NULL, 2, NULL);
    // -> 3 Task chạy "song song", hoàn toàn độc lập!
}`
      }
    ]
  },
  {
    id: 2,
    phase: "Giai đoạn 2",
    weeks: "Tuần 3–4",
    title: "Đồng bộ hóa (Synchronisation)",
    desc: "Queues, semaphores, mutexes, event groups. Xây dựng demo producer–consumer. Cố ý tạo và debug lỗi priority-inversion (đảo ngược mức ưu tiên).",
    color: "bg-purple-500",
    details: [
      {
        topic: "1. Truyền dữ liệu an toàn với Queues",
        content: "Queue (Hàng đợi) là phương pháp an toàn nhất để giao tiếp giữa các Task. Dữ liệu được copy hẳn vào queue (pass-by-value), giúp tránh các lỗi nguy hiểm liên quan đến con trỏ và vùng nhớ dùng chung. Nếu Queue đầy, Task gửi có thể tự động vào trạng thái Blocked để chờ xếp hàng.",
        code: `// Khởi tạo queue chứa tối đa 10 số nguyên
QueueHandle_t xQueue = xQueueCreate(10, sizeof(int));

void vProducerTask(void *pvParameters) {
    int valueToSend = 42;
    for(;;) {
        // Gửi dữ liệu, chờ tối đa 100 ticks nếu Queue đang đầy
        xQueueSend(xQueue, &valueToSend, pdMS_TO_TICKS(100));
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}

void vConsumerTask(void *pvParameters) {
    int receivedValue;
    for(;;) {
        // Ngủ đông vô tận (portMAX_DELAY) cho đến khi có dữ liệu tới
        if(xQueueReceive(xQueue, &receivedValue, portMAX_DELAY) == pdPASS) {
            printf("Nhan duoc: %d\\n", receivedValue);
        }
    }
}`
      },
      {
        topic: "2. Đồng bộ Ngắt (ISR) bằng Binary Semaphore",
        content: "Thay vì dùng vòng lặp while() liên tục kiểm tra một biến cờ (flag) từ ngắt gây tốn CPU, ta dùng Binary Semaphore. Task sẽ ở trạng thái ngủ (Blocked). Khi Ngắt (ISR) xảy ra, nó 'Give' Semaphore, lập tức đánh thức Task dậy xử lý.",
        code: `SemaphoreHandle_t xBinarySemaphore;

// Hàm phục vụ ngắt (Ví dụ: Ngắt nút nhấn hoặc UART RX)
void IRAM_ATTR vInterruptHandler(void) {
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    
    // Bắt buộc dùng API hậu tố "FromISR" khi ở trong ngắt!
    xSemaphoreGiveFromISR(xBinarySemaphore, &xHigherPriorityTaskWoken);
    
    // Ép Scheduler chuyển Task ngay lập tức nếu Task chờ có Priority cao
    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}

void vHandlingTask(void *pvParameters) {
    xBinarySemaphore = xSemaphoreCreateBinary();
    for(;;) {
        // Task ngủ đông hoàn toàn, chờ ISR 'Give' semaphore
        if(xSemaphoreTake(xBinarySemaphore, portMAX_DELAY) == pdTRUE) {
            // ... Xử lý logic phức tạp tại đây (an toàn ngoài ngắt) ...
        }
    }
}`
      },
      {
        topic: "3. Bảo vệ tài nguyên dùng chung với Mutex",
        content: "Khi nhiều Task cùng truy cập một tài nguyên (ví dụ: in ra UART, ghi vào I2C, biến toàn cục), dữ liệu có thể bị rác (Race Condition). Mutex như một chiếc chìa khóa: Task nào lấy (Take) được thì mới được dùng tài nguyên, xong phải trả (Give) lại.\n\n*Lưu ý: Mutex có tính năng 'Priority Inheritance' (Kế thừa mức ưu tiên) giúp giảm rủi ro lỗi Priority Inversion.*",
        code: `SemaphoreHandle_t xMutex;

void vTaskUseResource(void *pvParameters) {
    // Khởi tạo Mutex (thường gọi ở hàm main trước khi Start Scheduler)
    xMutex = xSemaphoreCreateMutex();
    
    for(;;) {
        // Chờ đến khi lấy được Mutex
        if(xSemaphoreTake(xMutex, portMAX_DELAY) == pdTRUE) {
            
            // --- VÙNG LÂM TRẠNG (Critical Section) ---
            // An toàn truy cập tài nguyên
            printf("Task %s dang doc I2C\\n", pcTaskGetName(NULL));
            // ----------------------------------------
            
            // Bắt buộc trả lại Mutex khi dùng xong!
            xSemaphoreGive(xMutex);
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}`
      }
    ]
  },
  {
    id: 3,
    phase: "Giai đoạn 3",
    weeks: "Tuần 5–6",
    title: "Bộ nhớ & Định thời (Memory & timing)",
    desc: "Các mô hình Heap (heap_1–5), tính toán kích thước stack, software timers, tickless idle. Đo lường overhead khi chuyển đổi task (task switching) trên cả hai MCU.",
    color: "bg-orange-500",
    details: [
      {
        topic: "1. Quản lý bộ nhớ động (Heap_1 đến Heap_5)",
        content: "Khác với C tiêu chuẩn dùng malloc()/free() không dự đoán được thời gian, FreeRTOS cung cấp các thuật toán quản lý bộ nhớ riêng (pvPortMalloc và vPortFree).\n\n- **Heap_1**: Chỉ cho phép cấp phát, KHÔNG thể giải phóng (an toàn tuyệt đối, dùng cho các hệ thống khởi tạo 1 lần).\n- **Heap_4**: Phổ biến nhất. Cho phép cấp phát/giải phóng tự do và có thuật toán 'coalescence' (gộp các vùng nhớ trống) để chống phân mảnh RAM.\n- **Heap_5**: Giống Heap_4 nhưng cho phép gộp các vùng RAM nằm rải rác ở các địa chỉ khác nhau.",
        code: `// Thay vì dùng malloc() của C:
// uint8_t *pBuffer = (uint8_t *)malloc(1024);

// Hãy dùng API của FreeRTOS để thread-safe:
uint8_t *pBuffer = (uint8_t *)pvPortMalloc(1024 * sizeof(uint8_t));

if (pBuffer != NULL) {
    // Sử dụng bộ nhớ...
    
    // Khi dùng xong (với Heap_4 trở lên), hãy giải phóng:
    vPortFree(pBuffer);
}`
      },
      {
        topic: "2. Tối ưu RAM: Đo mức độ sử dụng Stack",
        content: "Mỗi Task khi tạo ra cần cấp phát một lượng RAM tĩnh (Stack). Nếu cấp thiếu -> Tràn Stack (Crash hệ thống). Cấp dư -> Lãng phí RAM. Giải pháp là dùng hàm `uxTaskGetStackHighWaterMark()` để xem Task đang 'còn trống' tối thiểu bao nhiêu từ khóa (words) kể từ lúc nó bắt đầu chạy.",
        code: `void vTaskDoSomething(void *pvParameters) {
    UBaseType_t uxHighWaterMark;

    // Lấy thông số lúc bắt đầu Task
    uxHighWaterMark = uxTaskGetStackHighWaterMark(NULL);
    printf("Stack trong ban dau: %u words\\n", uxHighWaterMark);

    for(;;) {
        // Thực thi logic của Task...
        
        // Thỉnh thoảng kiểm tra lại mức thấp nhất
        uxHighWaterMark = uxTaskGetStackHighWaterMark(NULL);
        
        // Nếu số này tiến gần về 0, bạn sắp bị Stack Overflow!
        // Cần tăng tham số usStackDepth trong xTaskCreate().
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}`
      },
      {
        topic: "3. Software Timers (Định thời bằng phần mềm)",
        content: "Nếu bạn cần một việc chạy định kỳ (VD: chớp LED 1s/lần), tạo một Task bằng `xTaskCreate` sẽ lãng phí nguyên một khối Stack. \nThay vào đó, dùng Software Timer. Nó được chạy ngầm bởi một 'Timer Service Task' duy nhất của hệ thống. Có 2 loại: \n- **Auto-reload**: Chạy lặp đi lặp lại.\n- **One-shot**: Chạy đúng 1 lần rồi dừng.",
        code: `// Hàm callback sẽ được gọi khi Timer hết hạn
void vTimerCallback(TimerHandle_t xTimer) {
    // Code xử lý nhanh gọn tại đây (KHÔNG dùng vTaskDelay trong callback này)
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
}

void setup() {
    // Tạo Software Timer lặp lại mỗi 1000ms (1 giây)
    TimerHandle_t xAutoReloadTimer = xTimerCreate(
        "BlinkTimer",           // Tên timer
        pdMS_TO_TICKS(1000),    // Chu kỳ (1000 ms)
        pdTRUE,                 // pdTRUE = Auto-reload, pdFALSE = One-shot
        (void *)0,              // ID của timer (nếu dùng chung 1 callback)
        vTimerCallback          // Hàm callback thực thi
    );

    // Khởi động Timer
    if (xAutoReloadTimer != NULL) {
        xTimerStart(xAutoReloadTimer, 0);
    }
}`
      }
    ]
  },
  {
    id: 4,
    phase: "Giai đoạn 4",
    weeks: "Tuần 7–8",
    title: "Dự án thực tế (Real project)",
    desc: "Port một dự án nhỏ giữa ESP32 và STM32. Viết tài liệu cho các quyết định porting. Thêm task ghi log qua UART. Đo lường độ trễ (latency).",
    color: "bg-green-500",
    details: [
      {
        topic: "1. Quản lý Log tập trung (UART Logging Task)",
        content: "Khi nhiều Task cùng in log ra UART (ví dụ dùng `printf`), dữ liệu dễ bị đan xen vào nhau hoặc làm gián đoạn hệ thống do UART rất chậm. Thực tế, ta sẽ tạo một 'Logger Task' chuyên quản lý ngoại vi UART. Các task khác chỉ việc ném chuỗi vào Queue, Logger Task sẽ lấy ra và in một cách tuần tự, an toàn.",
        code: `// Queue chứa con trỏ chuỗi (tiết kiệm RAM thay vì copy cả mảng ký tự)
QueueHandle_t xLogQueue;

void vTaskLogger(void *pvParameters) {
    char *pcMessageToPrint;
    for(;;) {
        // Chờ tin nhắn từ các task khác
        xQueueReceive(xLogQueue, &pcMessageToPrint, portMAX_DELAY);
        
        // In ra UART an toàn (không bị ngắt ngang hay dính chữ)
        printf("[LOG]: %s\\n", pcMessageToPrint);
        
        // Giải phóng bộ nhớ nếu chuỗi được cấp phát động (malloc)
        vPortFree(pcMessageToPrint);
    }
}`
      },
      {
        topic: "2. Kỹ thuật Porting: Lớp phần cứng (BSP)",
        content: "Để cùng một source code FreeRTOS chạy được trên cả ESP32 và STM32, tuyệt đối KHÔNG gọi trực tiếp hàm của chip (như `HAL_GPIO_TogglePin` hay `gpio_set_level`) bên trong nội dung Task. \nThay vào đó, tạo một lớp trừu tượng (Board Support Package - BSP). Task chỉ gọi `BSP_LED_Toggle()`, còn ruột của hàm đó sẽ dùng `#ifdef` tùy theo MCU bạn đang biên dịch.",
        code: `// --- Bên trong file BSP_Hardware.c ---
void BSP_LED_Toggle(void) {
#ifdef PLATFORM_STM32
    HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);
#elif defined(PLATFORM_ESP32)
    uint8_t state = gpio_get_level(LED_PIN);
    gpio_set_level(LED_PIN, !state);
#endif
}

// --- Bên trong file main.c (Nơi định nghĩa Task) ---
void vTaskBlink(void *pvParameters) {
    for(;;) {
        BSP_LED_Toggle(); // Code này "mù phần cứng", chạy hoàn hảo trên mọi chip!
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}`
      },
      {
        topic: "3. Đo lường hiệu năng (Profiling) & Độ trễ",
        content: "Bạn có thể bật tính năng `configGENERATE_RUN_TIME_STATS` để xem bảng thống kê % CPU mà mỗi task đang chiếm.\nTuy nhiên, để đo chính xác 'độ trễ' (latency) từ lúc có ngắt đến lúc Task chạy, phương pháp phần cứng (bật/tắt 1 chân GPIO và dùng Logic Analyzer đo độ rộng xung) luôn là chuẩn mực nhất trong công nghiệp.",
        code: `// Ví dụ đo thời gian thực thi bằng GPIO và Logic Analyzer
void vTaskHeavyMath(void *pvParameters) {
    for(;;) {
        // ... chờ trigger (semaphore/queue) nào đó ...
        
        BSP_DebugPin_High(); // Kéo chân GPIO lên mức CAO
        
        // --- Khối code cần đo thời gian thực thi ---
        Calculate_FFT_Algorithm(); 
        // ------------------------------------------
        
        BSP_DebugPin_Low(); // Kéo chân GPIO xuống mức THẤP
        
        // -> Kết nối Logic Analyzer hoặc dao động ký vào chân DebugPin.
        // Độ rộng xung nhìn thấy chính xác là thời gian CPU xử lý FFT!
    }
}`
      }
    ]
  }
];

const SKILLS = [
  { id: 1, text: "Tạo một Task cơ bản và chạy thành công", tags: ["Cả hai"] },
  { id: 2, text: "Cấu hình mức ưu tiên (Priority) cho nhiều Task", tags: ["Cả hai"] },
  { id: 3, text: "Hiểu và cấu hình Tick Rate (configTICK_RATE_HZ)", tags: ["Cả hai"] },
  { id: 4, text: "Sử dụng vTaskDelay và vTaskDelayUntil chính xác", tags: ["Cả hai"] },
  { id: 5, text: "Gửi/Nhận dữ liệu qua Queue giữa các Tasks", tags: ["Cả hai"] },
  { id: 6, text: "Sử dụng Binary Semaphore để đồng bộ ngắt (ISR) và Task", tags: ["Cả hai"] },
  { id: 7, text: "Sử dụng Counting Semaphore quản lý tài nguyên", tags: ["Cả hai"] },
  { id: 8, text: "Dùng Mutex bảo vệ tài nguyên (tránh Race Condition)", tags: ["Cả hai"] },
  { id: 9, text: "Tạo lỗi Priority Inversion và quan sát qua UART/Logic Analyzer", tags: ["Cả hai"] },
  { id: 10, text: "Sử dụng Event Groups để chờ nhiều sự kiện cùng lúc", tags: ["Cả hai"] },
  { id: 11, text: "Sử dụng Task Notifications (tối ưu hiệu suất thay vì Queue)", tags: ["Cả hai"] },
  { id: 12, text: "Cấu hình và sử dụng Software Timers (One-shot & Auto-reload)", tags: ["Cả hai"] },
  { id: 13, text: "Cấu hình bộ nhớ Heap (hiểu sự khác biệt heap_1 đến heap_5)", tags: ["Cả hai"] },
  { id: 14, text: "Bật configCHECK_FOR_STACK_OVERFLOW và debug tràn stack", tags: ["Cả hai"] },
  { id: 15, text: "Đo lường thời gian thực thi (Run Time Stats)", tags: ["STM32"] },
  { id: 16, text: "Chạy Task trên 2 Core khác nhau (Symmetric Multiprocessing)", tags: ["ESP32"] },
];

const DRILLS = [
  {
    id: "d1",
    q: "Làm sao FreeRTOS biết lúc nào cần chuyển (switch) Task đang chạy?",
    a: "Dựa vào ngắt Tick Interrupt (SysTick timer). Mỗi nhịp tick, Scheduler sẽ chạy và kiểm tra xem có Task nào độ ưu tiên cao hơn đang ở trạng thái Ready hay không, hoặc Task hiện tại đã hết time slice (nếu cấu hình time slicing)."
  },
  {
    id: "d2",
    q: "Sự khác biệt lớn nhất giữa Mutex và Binary Semaphore là gì?",
    a: "Mutex có cơ chế Priority Inheritance (Kế thừa mức ưu tiên) để chống lại Priority Inversion. Ngoài ra, Mutex thường yêu cầu Task nào 'Take' thì Task đó phải 'Give', trong khi Semaphore có thể được 'Give' từ một Task khác hoặc từ Ngắt (ISR)."
  },
  {
    id: "d3",
    q: "Khi nào nên dùng Task Notification thay vì Queue hay Semaphore?",
    a: "Khi bạn chỉ cần đồng bộ hoặc gửi một trạng thái/giá trị đơn giản cho MỘT Task cụ thể. Task Notification nhanh hơn khoảng 45% và tốn ít RAM hơn so với Queue/Semaphore."
  },
  {
    id: "d4",
    q: "Tại sao từ khóa 'FromISR' (ví dụ: xQueueSendFromISR) lại cần thiết trong ngắt?",
    a: "Các hàm API thông thường có thể khiến Task bị block (ví dụ chờ timeout). Hàm ISR không thể bị block. Các hàm 'FromISR' được thiết kế đặc biệt an toàn cho ngắt, không gây block và không gọi scheduler trực tiếp."
  },
  {
    id: "d5",
    q: "Hiện tượng Priority Inversion (Đảo ngược mức ưu tiên) là gì?",
    a: "Là khi một Task ưu tiên CAO phải chờ một tài nguyên đang bị giữ bởi Task ưu tiên THẤP, nhưng Task ưu tiên THẤP lại bị chiếm quyền (preempted) bởi một Task ưu tiên TRUNG BÌNH. Hậu quả: Task CAO bị block bởi Task TRUNG BÌNH."
  },
  {
    id: "d6",
    q: "Heap_1 khác Heap_4 ở điểm nào quan trọng nhất?",
    a: "Heap_1 chỉ cho phép cấp phát bộ nhớ (malloc) nhưng KHÔNG cho phép giải phóng (free). Nó an toàn nhưng không linh hoạt. Heap_4 cho phép giải phóng và có khả năng gộp các block trống lại với nhau (coalescence) để tránh phân mảnh."
  },
  {
    id: "d7",
    q: "Tickless Idle giúp tiết kiệm năng lượng như thế nào?",
    a: "Thông thường FreeRTOS thức dậy mỗi ms (tick) để kiểm tra Scheduler. Tickless Idle sẽ dừng ngắt Tick này khi hệ thống vào trạng thái Idle trong một khoảng thời gian dài, giúp MCU vào chế độ Deep Sleep lâu hơn."
  },
  {
    id: "d8",
    q: "Dấu hiệu dễ thấy nhất khi xảy ra Stack Overflow ở một Task là gì?",
    a: "Chương trình crash đột ngột, nhảy vào HardFault Handler (trên ARM Cortex-M) hoặc bị reset liên tục (watchdog). Nếu bật configCHECK_FOR_STACK_OVERFLOW, hàm vApplicationStackOverflowHook() sẽ được gọi."
  }
];

const PITFALLS = [
  {
    id: "p1",
    tag: "Bộ nhớ",
    tagColor: "bg-red-100 text-red-700",
    title: "Trả về địa chỉ biến cục bộ (Dangling Pointer)",
    scenario: "Hàm get_message() xây dựng chuỗi trong biến cục bộ rồi trả về con trỏ tới nó. Task gọi hàm và dùng con trỏ đó để gửi UART.",
    bugCode: `char* get_message(void) {
    char msg[32];  // Biến LOCAL trên Stack của hàm này
    sprintf(msg, "Temp: %d", read_temp());
    return msg;    // Trả về địa chỉ của msg
}  // <-- Hàm kết thúc: Stack frame bị HỦY, msg không còn tồn tại!

void task(void *arg) {
    while(1) {
        char* ptr = get_message();
        uart_send(ptr); // ptr trỏ vào vùng nhớ đã bị HỦY!
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}`,
    questions: [
      "Đoạn code có vấn đề gì không?",
      "Vì sao đôi khi cho ra giá trị đúng, đôi khi ra giá trị rác?",
      "Sửa thế nào?"
    ],
    explanation: "Biến `msg[32]` là biến cục bộ, nằm trên Stack Frame của hàm get_message(). Khi hàm return, Stack Frame đó bị giải phóng. Con trỏ `ptr` vẫn trỏ vào địa chỉ cũ — nhưng vùng nhớ đó giờ có thể bị ghi đè bởi bất kỳ lời gọi hàm nào khác (kể cả Scheduler FreeRTOS).\n\nĐôi khi ra đúng vì: Vùng nhớ cũ chưa kịp bị ghi đè.\nĐôi khi ra rác vì: Vùng nhớ đã bị Scheduler hoặc Task khác ghi đè mất.",
    fixCode: `// CÁCH 1: Dùng static (biến tồn tại suốt chương trình)
char* get_message(void) {
    static char msg[32]; // static: tồn tại mãi, không bị hủy
    sprintf(msg, "Temp: %d", read_temp());
    return msg; // An toàn!
}
// Lưu ý: static không thread-safe nếu nhiều task cùng gọi!

// CÁCH 2 (Khuyến nghị): Caller cấp phát buffer, callee điền vào
void get_message(char* buf, size_t len) {
    snprintf(buf, len, "Temp: %d", read_temp());
}

void task(void *arg) {
    char msg[32]; // Buffer trên Stack của TASK - tồn tại suốt vòng lặp
    while(1) {
        get_message(msg, sizeof(msg));
        uart_send(msg); // An toàn!
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}`
  },
  {
    id: "p2",
    tag: "Đồng bộ hóa",
    tagColor: "bg-orange-100 text-orange-700",
    title: "Dùng Semaphore thay Mutex để bảo vệ tài nguyên dùng chung",
    scenario: "Bạn có biến toàn cục `g_counter` được 2 task đọc/ghi. Dùng Binary Semaphore để bảo vệ nó thay vì Mutex.",
    bugCode: `SemaphoreHandle_t xSem;
int g_counter = 0;

void vTaskA(void *p) {
    for(;;) {
        xSemaphoreTake(xSem, portMAX_DELAY);
        g_counter++;          // Critical section
        xSemaphoreGive(xSem);
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

void vTaskB(void *p) {
    for(;;) {
        xSemaphoreTake(xSem, portMAX_DELAY);
        g_counter--;          // Critical section
        xSemaphoreGive(xSem);
        vTaskDelay(pdMS_TO_TICKS(15));
    }
}`,
    questions: [
      "Binary Semaphore có ngăn được Race Condition trong trường hợp này không?",
      "Sự khác biệt thực sự giữa Semaphore và Mutex ở đây là gì?",
      "Khi nào thì bắt buộc phải dùng Mutex thay vì Semaphore?"
    ],
    explanation: "Binary Semaphore CÓ THỂ ngăn Race Condition trong trường hợp đơn giản này — về mặt kỹ thuật nó hoạt động như Mutex thô.\n\nTuy nhiên có 2 vấn đề nghiêm trọng khi hệ thống phức tạp hơn:\n\n1. KHÔNG có Priority Inheritance: Nếu TaskA (priority cao) đang chờ Semaphore mà TaskB (priority thấp) đang giữ, TaskB có thể bị TaskC (priority trung) chiếm quyền → TaskA bị block mãi (Priority Inversion).\n\n2. Ownership không rõ ràng: Semaphore có thể được Give từ bất kỳ Task nào — kể cả Task không Take nó. Mutex yêu cầu đúng Task đã Take mới được Give → tránh lỗi logic.",
    fixCode: `// ĐÚNG: Dùng Mutex để bảo vệ tài nguyên dùng chung
SemaphoreHandle_t xMutex;
int g_counter = 0;

void app_main(void) {
    xMutex = xSemaphoreCreateMutex(); // Tạo Mutex (có Priority Inheritance)
    xTaskCreate(vTaskA, "A", 2048, NULL, 2, NULL);
    xTaskCreate(vTaskB, "B", 2048, NULL, 1, NULL);
}

void vTaskA(void *p) {
    for(;;) {
        if(xSemaphoreTake(xMutex, portMAX_DELAY) == pdTRUE) {
            g_counter++;
            xSemaphoreGive(xMutex); // Bắt buộc chính Task này Give lại
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}
// Quy tắc: Mutex = bảo vệ tài nguyên (ownership)
//          Semaphore = báo hiệu sự kiện (signaling)`
  },
  {
    id: "p3",
    tag: "Stack",
    tagColor: "bg-purple-100 text-purple-700",
    title: "Stack Overflow im lặng do mảng cục bộ quá lớn",
    scenario: "Task đọc file JSON từ UART, parse và xử lý. Task được cấp 2048 bytes stack. Thỉnh thoảng hệ thống crash không rõ nguyên nhân.",
    bugCode: `void vTaskParseJSON(void *p) {
    for(;;) {
        // Mảng cục bộ 2KB trên Stack của Task!
        char raw_buffer[1024];   // 1024 bytes
        char parsed[512];        // 512 bytes  
        char temp[256];          // 256 bytes
        // Tổng: ~1792 bytes chỉ riêng 3 mảng này
        // Stack Task chỉ có 2048 bytes -> còn ~256 bytes cho call stack!
        
        uart_receive(raw_buffer, sizeof(raw_buffer));
        json_parse(raw_buffer, parsed); // Gọi hàm -> thêm stack frame!
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}`,
    questions: [
      "Stack Overflow xảy ra khi nào và tại sao đôi khi không crash ngay?",
      "Làm sao phát hiện sớm vấn đề này mà không cần chờ crash?",
      "Cách sửa và phòng ngừa?"
    ],
    explanation: "Stack Task = 2048 bytes. Ba mảng cục bộ đã chiếm ~1792 bytes. Khi gọi json_parse(), cần thêm Stack Frame cho hàm đó (~vài trăm bytes). Tổng vượt 2048 → Stack Overflow.\n\nKhông crash ngay vì: FreeRTOS không luôn kiểm tra overflow sau mỗi lệnh. Dữ liệu tràn ghi đè TCB hoặc Stack của Task khác → crash ở vị trí hoàn toàn khác, rất khó debug.\n\nPhát hiện sớm: Gọi uxTaskGetStackHighWaterMark(NULL) để xem số bytes còn trống tối thiểu. Nếu < 50 words → nguy hiểm!",
    fixCode: `// CÁCH 1: Tăng Stack khi tạo Task (đơn giản nhất)
xTaskCreate(vTaskParseJSON, "JSON", 4096, NULL, 1, NULL); // Tăng 2048->4096

// CÁCH 2: Dùng Static/Global buffer (không dùng Stack)
static char raw_buffer[1024]; // Nằm ở BSS segment, không chiếm Stack
static char parsed[512];

void vTaskParseJSON(void *p) {
    for(;;) {
        uart_receive(raw_buffer, sizeof(raw_buffer));
        json_parse(raw_buffer, parsed);
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

// CÁCH 3: Theo dõi Stack Usage trong quá trình dev
void vTaskMonitor(void *p) {
    for(;;) {
        UBaseType_t mark = uxTaskGetStackHighWaterMark(xJSONTaskHandle);
        if(mark < 50) {
            ESP_LOGW("STACK", "JSON Task sap tran stack! Con: %u words", mark);
        }
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}`
  },
  {
    id: "p4",
    tag: "ISR",
    tagColor: "bg-blue-100 text-blue-700",
    title: "Gọi hàm FreeRTOS thông thường bên trong ngắt (ISR)",
    scenario: "Nút nhấn tạo ngắt GPIO. Trong ISR, bạn muốn gửi dữ liệu vào Queue để Task xử lý.",
    bugCode: `QueueHandle_t xButtonQueue;

// ISR - Ngắt GPIO khi nút nhấn
void IRAM_ATTR gpio_isr_handler(void* arg) {
    uint32_t gpio_num = (uint32_t) arg;
    
    // SAI: Gọi hàm thông thường trong ISR!
    xQueueSend(xButtonQueue, &gpio_num, 100); 
    // xQueueSend có thể BLOCK nếu Queue đầy
    // ISR không được phép block -> Crash/Deadlock!
}`,
    questions: [
      "Tại sao không được gọi xQueueSend() bình thường trong ISR?",
      "Hậu quả là gì nếu Queue đầy và ISR cố block?",
      "API đúng cần dùng là gì?"
    ],
    explanation: "Hàm xQueueSend() thông thường có thể gây BLOCK Task hiện tại nếu Queue đầy (chờ đến timeout). Nhưng ISR không phải là một Task — nó không có Context để block.\n\nNếu gọi hàm blocking trong ISR:\n- Hệ thống có thể rơi vào Deadlock\n- Scheduler bị gọi sai thời điểm → Crash hoặc HardFault\n- Trên ESP32: Watchdog Timer sẽ reset hệ thống\n\nMọi hàm FreeRTOS gọi từ ISR PHẢI dùng phiên bản hậu tố FromISR.",
    fixCode: `void IRAM_ATTR gpio_isr_handler(void* arg) {
    uint32_t gpio_num = (uint32_t) arg;
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    
    // ĐÚNG: Dùng phiên bản FromISR - không bao giờ block
    xQueueSendFromISR(xButtonQueue, &gpio_num, &xHigherPriorityTaskWoken);
    
    // Nếu gửi thành công và có Task đang chờ với priority cao hơn
    // -> Ép Scheduler chuyển sang Task đó ngay khi thoát ISR
    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}

// Các hàm FromISR thường dùng:
// xQueueSendFromISR()       -> thay xQueueSend()
// xSemaphoreGiveFromISR()   -> thay xSemaphoreGive()
// xTaskNotifyFromISR()      -> thay xTaskNotify()
// vTaskNotifyGiveFromISR()  -> thay vTaskNotifyGive()`
  }
];

const DEFAULT_CHEATSHEET = [
  {
    id: 1,
    title: "Tạo Task cơ bản (xTaskCreate)",
    desc: "Đăng ký một Task mới với Scheduler. Cần cung cấp hàm thực thi, tên, stack size và priority.",
    code: `xTaskCreate(vTaskFunction, "TaskName", 2048, NULL, 1, &xTaskHandle);`
  },
  {
    id: 2,
    title: "Tạm dừng Task (vTaskDelay)",
    desc: "Đưa Task hiện tại vào trạng thái Blocked (nhường CPU) trong một số Ticks cụ thể.",
    code: `vTaskDelay(pdMS_TO_TICKS(1000)); // Delay chính xác 1 giây`
  },
  {
    id: 3,
    title: "Gửi dữ liệu vào Queue",
    desc: "Gửi giá trị vào hàng đợi, chờ tối đa 100 ticks nếu queue đang đầy.",
    code: `xQueueSend(xQueue, &valueToSend, pdMS_TO_TICKS(100));`
  },
  {
    id: 4,
    title: "Đợi/Lấy Mutex (xSemaphoreTake)",
    desc: "Chờ lấy khóa Mutex để truy cập tài nguyên dùng chung, chờ vô tận (portMAX_DELAY).",
    code: `if(xSemaphoreTake(xMutex, portMAX_DELAY) == pdTRUE) {
    // ... Sử dụng tài nguyên an toàn ...
    xSemaphoreGive(xMutex); // Bắt buộc trả lại
}`
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  // Two-Panel Roadmap states
  const [selectedPhase, setSelectedPhase] = useState(1);
  const [selectedTopic, setSelectedTopic] = useState(0);
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);
  const [checkedSkills, setCheckedSkills] = useState({});
  const [decisionLogs, setDecisionLogs] = useState([]);
  const [newLog, setNewLog] = useState('');
  
  // Flashcard & Cheatsheet states
  const [drillStatus, setDrillStatus] = useState({});
  const [cheatsheet, setCheatsheet] = useState(DEFAULT_CHEATSHEET);
  const [showAddApi, setShowAddApi] = useState(false);
  const [newApi, setNewApi] = useState({ title: '', desc: '', code: '' });

  // Load state from local storage on mount
  useEffect(() => {
    const savedSkills = localStorage.getItem('freertos_skills');
    if (savedSkills) setCheckedSkills(JSON.parse(savedSkills));

    const savedLogs = localStorage.getItem('freertos_logs');
    if (savedLogs) setDecisionLogs(JSON.parse(savedLogs));

    const savedDrillStatus = localStorage.getItem('freertos_drill_status');
    if (savedDrillStatus) setDrillStatus(JSON.parse(savedDrillStatus));

    const savedCheatsheet = localStorage.getItem('freertos_cheatsheet');
    if (savedCheatsheet) setCheatsheet(JSON.parse(savedCheatsheet));
  }, []);

  // Save state to local storage when it changes
  useEffect(() => {
    localStorage.setItem('freertos_skills', JSON.stringify(checkedSkills));
  }, [checkedSkills]);

  useEffect(() => {
    localStorage.setItem('freertos_logs', JSON.stringify(decisionLogs));
  }, [decisionLogs]);

  useEffect(() => {
    localStorage.setItem('freertos_drill_status', JSON.stringify(drillStatus));
  }, [drillStatus]);

  useEffect(() => {
    localStorage.setItem('freertos_cheatsheet', JSON.stringify(cheatsheet));
  }, [cheatsheet]);

  const toggleSkill = (id) => {
    setCheckedSkills(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const addLog = () => {
    if (newLog.trim() === '') return;
    const logEntry = {
      id: Date.now(),
      text: newLog,
      date: new Date().toLocaleDateString('vi-VN')
    };
    setDecisionLogs([logEntry, ...decisionLogs]);
    setNewLog('');
  };

  const deleteLog = (id) => {
    setDecisionLogs(decisionLogs.filter(log => log.id !== id));
  };

  const handleDrillStatus = (id, status) => {
    setDrillStatus(prev => ({ ...prev, [id]: status }));
  };

  const handleAddApi = () => {
    if (!newApi.title || !newApi.code) return;
    const addedApi = { ...newApi, id: Date.now() };
    setCheatsheet([addedApi, ...cheatsheet]);
    setNewApi({ title: '', desc: '', code: '' });
    setShowAddApi(false);
  };

  const copyToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Lỗi khi sao chép', err);
    }
    document.body.removeChild(textArea);
  };

  const tabs = [
    { id: 'home', icon: BookOpen, label: 'Tổng quan' },
    { id: 'roadmap', icon: Map, label: 'Lộ trình' },
    { id: 'checklist', icon: CheckSquare, label: 'Kỹ năng' },
    { id: 'drills', icon: BrainCircuit, label: 'Gợi nhớ' },
    { id: 'pitfalls', icon: FlaskConical, label: 'Bẫy thực tế' },
    { id: 'cheatsheet', icon: Zap, label: 'Cheatsheet' },
    { id: 'logs', icon: PenTool, label: 'Nhật ký' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-10 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Cpu className="text-blue-400 w-8 h-8" />
              <h1 className="font-bold text-xl tracking-tight">FreeRTOS Mastery</h1>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id 
                      ? 'bg-blue-600 text-white' 
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="md:hidden bg-slate-800 flex overflow-x-auto p-2 gap-2 sticky top-16 z-10 border-t border-slate-700 shadow-sm">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center flex-1 p-2 rounded text-xs whitespace-nowrap transition-colors ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-5 h-5 mb-1" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* --- TAB: HOME --- */}
        {activeTab === 'home' && (
          <div className="space-y-8 animate-fade-in">
            <div className="bg-white rounded-xl shadow-sm p-6 md:p-8 border border-slate-200">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-4">
                Framework tự học FreeRTOS của bạn
              </h2>
              <p className="text-slate-600 text-lg mb-6 leading-relaxed">
                Hệ thống này được thiết kế dựa trên phương pháp học chủ động, chia làm 4 phần cốt lõi để dẫn dắt bạn từ người mới bắt đầu đến khi thực sự làm chủ RTOS.
              </p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-5 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-3 mb-2 text-blue-700 font-semibold">
                    <Map className="w-5 h-5" /> Lộ trình (Roadmap)
                  </div>
                  <p className="text-sm text-slate-700">Hành trình 8 tuần từ nền tảng đến dự án porting thực tế. Mỗi giai đoạn kết thúc bằng một sản phẩm cụ thể, không chỉ là lý thuyết suông.</p>
                </div>
                
                <div className="bg-emerald-50 p-5 rounded-lg border border-emerald-100">
                  <div className="flex items-center gap-3 mb-2 text-emerald-700 font-semibold">
                    <CheckSquare className="w-5 h-5" /> Danh sách kỹ năng (Checklist)
                  </div>
                  <p className="text-sm text-slate-700">16 kỹ năng cụ thể, có thể kiểm chứng được gắn thẻ nền tảng. Tiến độ của bạn sẽ được lưu trữ tự động trên trình duyệt này.</p>
                </div>

                <div className="bg-purple-50 p-5 rounded-lg border border-purple-100">
                  <div className="flex items-center gap-3 mb-2 text-purple-700 font-semibold">
                    <BrainCircuit className="w-5 h-5" /> Bài tập gợi nhớ (Recall drills)
                  </div>
                  <p className="text-sm text-slate-700">8 khái niệm cốt lõi. Hãy tự trả lời trước khi xem đáp án. Ép buộc "chủ động gợi nhớ" là cách hiệu quả nhất để ghi nhớ kiến thức nhúng.</p>
                </div>

                <div className="bg-amber-50 p-5 rounded-lg border border-amber-100">
                  <div className="flex items-center gap-3 mb-2 text-amber-700 font-semibold">
                    <Calendar className="w-5 h-5" /> Lịch ôn tập ngắt quãng
                  </div>
                  <p className="text-sm text-slate-700">Hành động ôn tập tốt nhất không phải đọc lại, mà là <strong>xây dựng lại trên một MCU khác</strong>. Porting giữa ESP32 & STM32 giúp nhận ra đâu là chuẩn chung, đâu là đặc thù nền tảng.</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-xl shadow-lg p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <AlertCircle className="w-32 h-32" />
              </div>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Terminal className="w-6 h-6 text-yellow-400" />
                Mẹo chuyên gia cho ngành Nhúng
              </h3>
              <ul className="space-y-4 text-slate-300 relative z-10">
                <li className="flex gap-3">
                  <ChevronRight className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <span><strong>Giữ một "Nhật ký quyết định" (Decision Log):</strong> Mỗi lần chọn cấu hình FreeRTOS (stack size, heap model, priority), hãy viết 1 câu giải thích lý do (ở tab Nhật ký). Xem lại chúng giá trị hơn việc đọc lại docs rất nhiều.</span>
                </li>
                <li className="flex gap-3">
                  <ChevronRight className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <span><strong>Bài tập Priority-Inversion (Mục #9) nên làm 2 lần:</strong> Lần 1 quan sát hiện tượng, lần 2 thực sự debug nó bằng Logic Analyzer hoặc UART trace để hiểu thấu đáo luồng chạy.</span>
                </li>
                <li className="flex gap-3">
                  <ChevronRight className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <span><strong>Nguyên tắc gợi nhớ:</strong> Nếu bạn gặp một khái niệm mà không thể giải thích bằng lời (mà không tra Google), đó chính là bài học cho phiên ôn tập tiếp theo, không phải để tuần sau!</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* --- TAB: ROADMAP (Two-Panel Layout) --- */}
        {activeTab === 'roadmap' && (() => {
          const currentPhase = ROADMAP.find(p => p.id === selectedPhase) || ROADMAP[0];
          const currentDetail = currentPhase.details?.[selectedTopic];
          const totalTopics = ROADMAP.reduce((sum, p) => sum + (p.details?.length || 0), 0);
          
          // Calculate global topic index for progress
          let globalIndex = 0;
          for (const p of ROADMAP) {
            if (p.id === selectedPhase) { globalIndex += selectedTopic; break; }
            globalIndex += (p.details?.length || 0);
          }

          return (
          <div className="animate-fade-in">
            {/* Progress Bar */}
            <div className="max-w-6xl mx-auto mb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <Map className="text-blue-600" /> Lộ trình học FreeRTOS
                </h2>
                <span className="text-sm font-medium text-slate-500">
                  {globalIndex + 1} / {totalTopics} chủ đề
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${((globalIndex + 1) / totalTopics) * 100}%` }}
                />
              </div>
            </div>

            <div className="max-w-6xl mx-auto flex gap-6" style={{ minHeight: '70vh' }}>
              
              {/* === LEFT SIDEBAR (Phase & Topic Navigation) === */}
              <aside className={`${
                showMobileSidebar ? 'block' : 'hidden'
              } md:block w-full md:w-80 shrink-0`}>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-36">
                  <div className="p-4 bg-slate-800 text-white">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <List className="w-4 h-4" /> MỤC LỤC
                    </div>
                  </div>
                  
                  <nav className="divide-y divide-slate-100 max-h-[calc(100vh-220px)] overflow-y-auto">
                    {ROADMAP.map((phase) => (
                      <div key={phase.id}>
                        {/* Phase Header */}
                        <button
                          onClick={() => {
                            setSelectedPhase(phase.id);
                            setSelectedTopic(0);
                            setShowMobileSidebar(false);
                          }}
                          className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm font-bold transition-colors ${
                            selectedPhase === phase.id
                              ? 'bg-slate-100 text-slate-900'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`w-3 h-3 rounded-full shrink-0 ${phase.color}`} />
                          <span className="flex-1">{phase.phase}: {phase.title}</span>
                          <span className="text-xs text-slate-400 font-normal">{phase.weeks}</span>
                        </button>
                        
                        {/* Topic List (visible when phase is selected) */}
                        {selectedPhase === phase.id && phase.details && (
                          <div className="bg-slate-50/50">
                            {phase.details.map((detail, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setSelectedTopic(idx);
                                  setShowMobileSidebar(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 pl-10 text-sm transition-all flex items-center gap-2 ${
                                  selectedTopic === idx
                                    ? 'bg-blue-50 text-blue-700 font-semibold border-r-3 border-blue-500'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  selectedTopic === idx ? 'bg-blue-500' : 'bg-slate-300'
                                }`} />
                                <span className="leading-snug">{detail.topic}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </nav>
                </div>
              </aside>

              {/* === RIGHT CONTENT PANEL === */}
              <main className={`${
                showMobileSidebar ? 'hidden' : 'block'
              } md:block flex-1 min-w-0`}>
                
                {/* Mobile: Back button */}
                <button
                  onClick={() => setShowMobileSidebar(true)}
                  className="md:hidden flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 mb-4 font-medium transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Quay lại mục lục
                </button>

                {currentDetail ? (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
                    {/* Topic Header */}
                    <div className={`px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white`}>
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${currentPhase.color}`} />
                        {currentPhase.phase} · {currentPhase.title}
                      </div>
                      <h3 className="text-xl md:text-2xl font-bold text-slate-800">
                        {currentDetail.topic}
                      </h3>
                    </div>

                    {/* Topic Content */}
                    <div className="p-6 space-y-6">
                      <div className="prose prose-slate max-w-none">
                        <p className="text-slate-700 text-base leading-relaxed whitespace-pre-line">
                          {currentDetail.content}
                        </p>
                      </div>

                      {/* Code Block */}
                      {currentDetail.code && (
                        <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-800/50">
                            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                              <Code className="w-4 h-4" /> C / C++
                            </div>
                            <button
                              onClick={() => copyToClipboard(currentDetail.code)}
                              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-700"
                            >
                              <Copy className="w-3.5 h-3.5" /> Copy
                            </button>
                          </div>
                          <div className="p-4 overflow-x-auto">
                            <pre className="text-sm font-mono text-emerald-400 leading-relaxed">
                              <code>{currentDetail.code}</code>
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Navigation Footer */}
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                      <button
                        onClick={() => {
                          if (selectedTopic > 0) {
                            setSelectedTopic(selectedTopic - 1);
                          } else {
                            const prevPhaseIdx = ROADMAP.findIndex(p => p.id === selectedPhase) - 1;
                            if (prevPhaseIdx >= 0) {
                              const prevPhase = ROADMAP[prevPhaseIdx];
                              setSelectedPhase(prevPhase.id);
                              setSelectedTopic((prevPhase.details?.length || 1) - 1);
                            }
                          }
                        }}
                        disabled={selectedPhase === ROADMAP[0].id && selectedTopic === 0}
                        className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-3 py-2 rounded-lg hover:bg-slate-100 disabled:hover:bg-transparent"
                      >
                        <ArrowLeft className="w-4 h-4" /> Bài trước
                      </button>
                      
                      <span className="text-xs text-slate-400 hidden sm:block">
                        {selectedTopic + 1} / {currentPhase.details?.length || 0} trong {currentPhase.phase}
                      </span>
                      
                      <button
                        onClick={() => {
                          if (selectedTopic < (currentPhase.details?.length || 0) - 1) {
                            setSelectedTopic(selectedTopic + 1);
                          } else {
                            const nextPhaseIdx = ROADMAP.findIndex(p => p.id === selectedPhase) + 1;
                            if (nextPhaseIdx < ROADMAP.length) {
                              setSelectedPhase(ROADMAP[nextPhaseIdx].id);
                              setSelectedTopic(0);
                            }
                          }
                        }}
                        disabled={selectedPhase === ROADMAP[ROADMAP.length - 1].id && selectedTopic === (currentPhase.details?.length || 1) - 1}
                        className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-3 py-2 rounded-lg hover:bg-slate-100 disabled:hover:bg-transparent"
                      >
                        Bài tiếp <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500 italic">
                    Chọn một chủ đề từ mục lục bên trái để bắt đầu.
                  </div>
                )}
              </main>
            </div>
          </div>
          );
        })()}

        {/* --- TAB: CHECKLIST --- */}
        {activeTab === 'checklist' && (
          <div className="max-w-4xl mx-auto animate-fade-in">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <CheckSquare className="text-emerald-600" /> Danh sách kỹ năng
                </h2>
                <p className="text-slate-500 text-sm">Trạng thái sẽ được lưu lại tự động. Hãy check khi bạn thực sự tự tin code được tính năng đó.</p>
              </div>
              <div className="text-sm font-bold bg-emerald-100 text-emerald-800 px-4 py-2 rounded-lg">
                {Object.values(checkedSkills).filter(Boolean).length} / {SKILLS.length}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <ul className="divide-y divide-slate-100">
                {SKILLS.map((skill) => (
                  <li 
                    key={skill.id} 
                    className={`flex items-start p-4 hover:bg-slate-50 transition-colors cursor-pointer ${checkedSkills[skill.id] ? 'bg-emerald-50/30' : ''}`}
                    onClick={() => toggleSkill(skill.id)}
                  >
                    <div className={`mt-0.5 w-6 h-6 rounded flex items-center justify-center shrink-0 mr-4 border-2 transition-colors ${
                      checkedSkills[skill.id] 
                        ? 'bg-emerald-500 border-emerald-500 text-white' 
                        : 'border-slate-300 bg-white'
                    }`}>
                      {checkedSkills[skill.id] && <Check className="w-4 h-4" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-base font-medium ${checkedSkills[skill.id] ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                        {skill.id}. {skill.text}
                      </p>
                      <div className="mt-1 flex gap-2">
                        {skill.tags.map(tag => (
                          <span key={tag} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            tag === 'ESP32' ? 'bg-orange-100 text-orange-700' :
                            tag === 'STM32' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* --- TAB: DRILLS --- */}
        {activeTab === 'drills' && (
          <div className="max-w-4xl mx-auto animate-fade-in">
            <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
              <BrainCircuit className="text-purple-600" /> Bài tập gợi nhớ (Flashcards)
            </h2>
            <p className="text-slate-600 mb-8">Hệ thống sẽ tự động ưu tiên những câu bạn đánh dấu "Quên" lên trên cùng để ôn tập lặp lại (Spaced Repetition).</p>

            <div className="grid gap-4">
              {[...DRILLS].sort((a, b) => {
                const weightA = drillStatus[a.id] === 'forgotten' ? 0 : (drillStatus[a.id] === 'remembered' ? 2 : 1);
                const weightB = drillStatus[b.id] === 'forgotten' ? 0 : (drillStatus[b.id] === 'remembered' ? 2 : 1);
                return weightA - weightB;
              }).map((drill, idx) => (
                <DrillCard 
                  key={drill.id} 
                  num={idx + 1} 
                  drill={drill} 
                  status={drillStatus[drill.id]}
                  onStatusChange={(newStatus) => handleDrillStatus(drill.id, newStatus)}
                />
              ))}
            </div>
          </div>
        )}

        {/* --- TAB: CHEATSHEET --- */}
        {activeTab === 'cheatsheet' && (
          <div className="max-w-4xl mx-auto animate-fade-in">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <Zap className="text-amber-500" /> Tra cứu nhanh API
                </h2>
                <p className="text-slate-600 text-sm">Các hàm FreeRTOS thường dùng nhất. Nhấn "Copy" để sao chép vào IDE của bạn.</p>
              </div>
              <button 
                onClick={() => setShowAddApi(!showAddApi)}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
              >
                {showAddApi ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showAddApi ? "Đóng" : "Thêm API mới"}
              </button>
            </div>

            {showAddApi && (
              <div className="bg-slate-100 p-5 rounded-xl border border-slate-200 mb-8 animate-fade-in space-y-4">
                <h3 className="font-bold text-slate-700">Thêm Snippet tùy chỉnh của bạn</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <input 
                    type="text" placeholder="Tên API hoặc Tiêu đề..." 
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={newApi.title} onChange={e => setNewApi({...newApi, title: e.target.value})}
                  />
                  <input 
                    type="text" placeholder="Mô tả ngắn gọn..." 
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={newApi.desc} onChange={e => setNewApi({...newApi, desc: e.target.value})}
                  />
                </div>
                <textarea 
                  placeholder="Nhập code C/C++ vào đây..." 
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono h-24"
                  value={newApi.code} onChange={e => setNewApi({...newApi, code: e.target.value})}
                />
                <button 
                  onClick={handleAddApi}
                  disabled={!newApi.title || !newApi.code}
                  className="bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Lưu Snippet
                </button>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              {cheatsheet.map((api) => (
                <div key={api.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-slate-100 flex-1">
                    <h3 className="font-bold text-slate-800 text-lg mb-1">{api.title}</h3>
                    <p className="text-slate-500 text-sm">{api.desc}</p>
                  </div>
                  <div className="bg-slate-900 relative group">
                    <button 
                      onClick={() => {
                        copyToClipboard(api.code);
                        // Optional: Có thể thêm toast thông báo copy thành công ở đây
                      }}
                      className="absolute top-2 right-2 bg-slate-700/50 hover:bg-blue-500 text-slate-300 hover:text-white p-1.5 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Sao chép code"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <pre className="p-4 overflow-x-auto text-sm font-mono text-emerald-400">
                      <code>{api.code}</code>
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- TAB: PITFALLS --- */}
        {activeTab === 'pitfalls' && (
          <div className="max-w-4xl mx-auto animate-fade-in">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-2">
                <FlaskConical className="text-rose-600" /> Bẫy thực tế (Pitfalls & Gotchas)
              </h2>
              <p className="text-slate-600">Những lỗi hay gặp khi làm thực tế. Đọc code, suy nghĩ trước khi xem đáp án — đây là cách học hiệu quả nhất.</p>
            </div>
            <div className="space-y-5">
              {PITFALLS.map((p, idx) => (
                <PitfallCard key={p.id} num={idx + 1} pitfall={p} />
              ))}
            </div>
          </div>
        )}

        {/* --- TAB: LOGS --- */}
        {activeTab === 'logs' && (
          <div className="max-w-4xl mx-auto animate-fade-in">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-2">
                <PenTool className="text-amber-600" /> Nhật ký quyết định (Decision Log)
              </h2>
              <p className="text-slate-600">Ghi lại lý do tại sao bạn chọn một cấu hình FreeRTOS cụ thể. (VD: "Chọn heap_4.c vì project có dùng MQTT cần malloc/free liên tục").</p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8 flex gap-3">
              <input 
                type="text" 
                value={newLog}
                onChange={(e) => setNewLog(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLog()}
                placeholder="Hôm nay tôi đã chọn cấu hình... vì..."
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button 
                onClick={addLog}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
              >
                <Plus className="w-5 h-5" /> Thêm
              </button>
            </div>

            <div className="space-y-4">
              {decisionLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                  Chưa có nhật ký nào. Hãy bắt đầu ghi chép các quyết định kỹ thuật của bạn nhé!
                </div>
              ) : (
                decisionLogs.map((log) => (
                  <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow group">
                    <div className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded shrink-0 mt-0.5">
                      {log.date}
                    </div>
                    <p className="flex-1 text-slate-700 text-sm md:text-base leading-relaxed">
                      {log.text}
                    </p>
                    <button 
                      onClick={() => deleteLog(log.id)}
                      className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Xóa"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>

      {/* Basic Custom Styles for Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}

// Sub-component for Recall Drills to handle individual toggle state
function DrillCard({ drill, num, status, onStatusChange }) {
  const [isOpen, setIsOpen] = useState(false);

  // Status visual indicators
  const borderStatusClass = status === 'remembered' ? 'border-l-4 border-l-emerald-500' : 
                            status === 'forgotten' ? 'border-l-4 border-l-red-500' : 
                            'border-l-4 border-l-transparent';

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-colors ${borderStatusClass}`}>
      <div 
        className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="font-bold text-slate-800 flex gap-3 text-base md:text-lg">
          <span className="text-purple-500">Q{num}.</span> {drill.q}
        </h3>
        <div className="flex items-center gap-3">
          {!isOpen && status === 'remembered' && <Check className="w-5 h-5 text-emerald-500" />}
          {!isOpen && status === 'forgotten' && <AlertCircle className="w-5 h-5 text-red-500" />}
          <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
        </div>
      </div>
      
      {isOpen && (
        <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50 animate-fade-in">
          <div className="flex gap-3 text-slate-700 mb-6">
            <span className="font-bold text-emerald-600">A.</span>
            <p className="leading-relaxed text-sm md:text-base">{drill.a}</p>
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4">
             <div className="flex gap-2">
                <button 
                  onClick={() => { onStatusChange('remembered'); setIsOpen(false); }}
                  className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                    status === 'remembered' 
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" /> Đã nhớ
                </button>
                <button 
                  onClick={() => { onStatusChange('forgotten'); setIsOpen(false); }}
                  className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                    status === 'forgotten' 
                      ? 'bg-red-100 text-red-700 border border-red-200' 
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <ThumbsDown className="w-4 h-4" /> Quên
                </button>
             </div>
             
             <button className="text-xs text-slate-500 hover:text-blue-600 font-medium transition-colors flex items-center gap-1">
                <BrainCircuit className="w-3.5 h-3.5" /> Hỏi AI sâu hơn
             </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component for Pitfall cards
function PitfallCard({ pitfall, num }) {
  const [phase, setPhase] = useState('read'); // 'read' | 'think' | 'reveal'

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-slate-400">#{num}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pitfall.tagColor}`}>{pitfall.tag}</span>
          </div>
          <h3 className="font-bold text-slate-800 text-base md:text-lg">{pitfall.title}</h3>
        </div>
        <Bug className="w-5 h-5 text-rose-400 shrink-0 mt-1" />
      </div>

      {/* Scenario */}
      <div className="px-5 py-4 bg-slate-50/50">
        <p className="text-sm text-slate-600 italic mb-3">📋 {pitfall.scenario}</p>

        {/* Buggy Code */}
        <div className="bg-slate-900 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-red-900/40 border-b border-red-900/30">
            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-semibold text-red-300">Code có vấn đề — tìm lỗi!</span>
          </div>
          <pre className="p-4 overflow-x-auto text-sm font-mono text-slate-300 leading-relaxed">
            <code>{pitfall.bugCode}</code>
          </pre>
        </div>
      </div>

      {/* Questions */}
      <div className="px-5 py-4 border-t border-slate-100">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Câu hỏi suy ngẫm:</p>
        <ol className="space-y-1.5">
          {pitfall.questions.map((q, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-700">
              <span className="font-bold text-rose-500 shrink-0">{i + 1}.</span>
              <span>{q}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Action Buttons */}
      {phase === 'read' && (
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={() => setPhase('reveal')}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 px-4 py-2.5 rounded-lg transition-colors"
          >
            <Eye className="w-4 h-4" /> Xem giải thích & cách sửa
          </button>
        </div>
      )}

      {/* Reveal: Explanation + Fix */}
      {phase === 'reveal' && (
        <div className="border-t border-slate-100 animate-fade-in">
          {/* Explanation */}
          <div className="px-5 py-4 bg-amber-50 border-b border-amber-100">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">🔍 Phân tích vấn đề</p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{pitfall.explanation}</p>
          </div>

          {/* Fix Code */}
          <div className="px-5 py-4">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">✅ Cách sửa đúng</p>
            <div className="bg-slate-900 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-900/30 border-b border-emerald-900/20">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-300">Fixed code</span>
              </div>
              <pre className="p-4 overflow-x-auto text-sm font-mono text-emerald-400 leading-relaxed">
                <code>{pitfall.fixCode}</code>
              </pre>
            </div>
          </div>

          <div className="px-5 pb-4">
            <button
              onClick={() => setPhase('read')}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              <EyeOff className="w-3.5 h-3.5" /> Thu gọn
            </button>
          </div>
        </div>
      )}
    </div>
  );
}