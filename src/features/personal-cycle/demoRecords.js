export const demoData = {
  schemaVersion: 1,
  person: {
    displayName: "妳",
    cycleLengthEstimate: null
  },
  records: [
    {
      id: "record-2026-05-24",
      occurredAt: "2026-05-24T20:30:00+08:00",
      cycle: {
        cycleId: "cycle-2026-05",
        day: 24,
        positionSource: "user_confirmed"
      },
      rawUserText: "今天特别烦，什么都不想做，小腹还有点疼",
      confirmationStatus: "confirmed",
      fields: {
        bleeding: {
          state: "none",
          level: null
        },
        pain: {
          state: "value",
          intensity: 5,
          locations: ["小腹"]
        },
        symptoms: {
          state: "value",
          values: ["疲乏", "易怒"]
        },
        sleep: {
          state: "value",
          hours: 5,
          quality: "较差"
        },
        mood: {
          state: "value",
          value: "烦躁"
        },
        energy: {
          state: "value",
          value: "偏低"
        },
        concentration: {
          state: "unknown",
          value: null
        },
        functionalImpact: {
          state: "value",
          values: ["工作效率下降"]
        },
        context: {
          state: "value",
          values: ["下午有会"]
        }
      },
      actions: [
        {
          id: "action-2026-05-24-001",
          label: "独处半小时，减少额外沟通",
          startedAt: "2026-05-24T21:00:00+08:00",
          outcome: "helped",
          outcomeAt: "2026-05-24T22:00:00+08:00",
          userNote: "安静下来以后好一些",
          otherConcurrentActions: []
        }
      ],
      provenance: {
        origin: "agent_conversation",
        fieldSources: {
          "fields.pain.intensity": "user_confirmed",
          "fields.sleep.hours": "user_confirmed",
          "fields.mood.value": "user_confirmed"
        }
      }
    },
    {
      id: "record-2026-05-15",
      occurredAt: "2026-05-15T10:00:00+08:00",
      cycle: {
        cycleId: "cycle-2026-05",
        day: 15,
        positionSource: "user_confirmed"
      },
      rawUserText: "今天感觉很疲惫，注意力不集中",
      confirmationStatus: "confirmed",
      fields: {
        bleeding: {
          state: "not_recorded",
          level: null
        },
        pain: {
          state: "not_recorded",
          intensity: null,
          locations: []
        },
        symptoms: {
          state: "value",
          values: ["疲乏"]
        },
        sleep: {
          state: "value",
          hours: 7,
          quality: "一般"
        },
        mood: {
          state: "not_recorded",
          value: null
        },
        energy: {
          state: "value",
          value: "中等"
        },
        concentration: {
          state: "value",
          value: "分散"
        },
        functionalImpact: {
          state: "not_recorded",
          values: []
        },
        context: {
          state: "value",
          values: ["周末休息"]
        }
      },
      actions: [
        {
          id: "action-2026-05-15-001",
          label: "喝一杯热牛奶，小憩15分钟",
          startedAt: "2026-05-15T10:30:00+08:00",
          outcome: "some",
          outcomeAt: "2026-05-15T11:00:00+08:00",
          userNote: "稍微好一点，但还是累",
          otherConcurrentActions: []
        }
      ],
      provenance: {
        origin: "agent_conversation",
        fieldSources: {
          "fields.energy.value": "user_confirmed"
        }
      }
    },
    {
      id: "record-2026-06-23",
      occurredAt: "2026-06-23T21:15:00+08:00",
      cycle: {
        cycleId: "cycle-2026-06",
        day: 23,
        positionSource: "user_confirmed"
      },
      rawUserText: "烦躁得睡不着，什么都不想做",
      confirmationStatus: "confirmed",
      fields: {
        bleeding: {
          state: "value",
          level: "少量"
        },
        pain: {
          state: "value",
          intensity: 4,
          locations: ["小腹", "后腰"]
        },
        symptoms: {
          state: "value",
          values: ["失眠", "易怒", "乳房胀痛"]
        },
        sleep: {
          state: "value",
          hours: 4,
          quality: "很差"
        },
        mood: {
          state: "value",
          value: "烦躁"
        },
        energy: {
          state: "value",
          value: "很低"
        },
        concentration: {
          state: "value",
          value: "难以集中"
        },
        functionalImpact: {
          state: "value",
          values: ["无法入睡", "工作效率明显下降"]
        },
        context: {
          state: "value",
          values: ["项目deadline临近"]
        }
      },
      actions: [
        {
          id: "action-2026-06-23-001",
          label: "独处半小时，减少额外沟通",
          startedAt: "2026-06-23T21:30:00+08:00",
          outcome: "pending",
          outcomeAt: null,
          userNote: "",
          otherConcurrentActions: []
        },
        {
          id: "action-2026-06-23-002",
          label: "服用布洛芬缓解疼痛",
          startedAt: "2026-06-23T22:00:00+08:00",
          outcome: "not_helped",
          outcomeAt: "2026-06-23T23:30:00+08:00",
          userNote: "疼痛没缓解，还觉得胃不舒服",
          otherConcurrentActions: ["action-2026-06-23-001"]
        }
      ],
      provenance: {
        origin: "agent_conversation",
        fieldSources: {
          "fields.pain.intensity": "user_confirmed",
          "fields.mood.value": "user_confirmed",
          "fields.bleeding.level": "user_confirmed"
        }
      }
    },
    {
      id: "record-2026-06-10",
      occurredAt: "2026-06-10T14:00:00+08:00",
      cycle: {
        cycleId: "cycle-2026-06",
        day: 10,
        positionSource: "user_confirmed"
      },
      rawUserText: "今天感觉还不错，就是有点困",
      confirmationStatus: "confirmed",
      fields: {
        bleeding: {
          state: "value",
          level: "中量"
        },
        pain: {
          state: "value",
          intensity: 2,
          locations: ["小腹"]
        },
        symptoms: {
          state: "none",
          values: []
        },
        sleep: {
          state: "value",
          hours: 8,
          quality: "良好"
        },
        mood: {
          state: "value",
          value: "平静"
        },
        energy: {
          state: "value",
          value: "充足"
        },
        concentration: {
          state: "value",
          value: "正常"
        },
        functionalImpact: {
          state: "none",
          values: []
        },
        context: {
          state: "value",
          values: ["周三，正常工作"]
        }
      },
      actions: [],
      provenance: {
        origin: "agent_conversation",
        fieldSources: {}
      }
    },
    {
      id: "record-2026-07-20",
      occurredAt: "2026-07-20T14:20:00+08:00",
      cycle: {
        cycleId: "cycle-2026-07",
        day: 24,
        positionSource: "user_confirmed"
      },
      rawUserText: "又开始烦躁了，小腹隐隐作痛",
      confirmationStatus: "confirmed",
      fields: {
        bleeding: {
          state: "not_recorded",
          level: null
        },
        pain: {
          state: "value",
          intensity: 3,
          locations: ["小腹"]
        },
        symptoms: {
          state: "value",
          values: ["易怒", "疲乏"]
        },
        sleep: {
          state: "value",
          hours: 6,
          quality: "一般"
        },
        mood: {
          state: "value",
          value: "烦躁"
        },
        energy: {
          state: "value",
          value: "偏低"
        },
        concentration: {
          state: "declined",
          value: null
        },
        functionalImpact: {
          state: "value",
          values: ["工作效率下降"]
        },
        context: {
          state: "value",
          values: ["下午有重要会议"]
        }
      },
      actions: [
        {
          id: "action-2026-07-20-001",
          label: "提前离开会议，短暂休息",
          startedAt: "2026-07-20T15:00:00+08:00",
          outcome: "some",
          outcomeAt: "2026-07-20T16:00:00+08:00",
          userNote: "休息后稍微好一点，但还是感觉累",
          otherConcurrentActions: []
        }
      ],
      provenance: {
        origin: "agent_conversation",
        fieldSources: {
          "fields.pain.intensity": "user_confirmed",
          "fields.mood.value": "user_confirmed"
        }
      }
    },
    {
      id: "record-2026-07-05",
      occurredAt: "2026-07-05T09:00:00+08:00",
      cycle: {
        cycleId: "cycle-2026-07",
        day: 9,
        positionSource: "user_confirmed"
      },
      rawUserText: "今天状态很好，精力充沛",
      confirmationStatus: "confirmed",
      fields: {
        bleeding: {
          state: "value",
          level: "少量"
        },
        pain: {
          state: "none",
          intensity: null,
          locations: []
        },
        symptoms: {
          state: "none",
          values: []
        },
        sleep: {
          state: "value",
          hours: 9,
          quality: "很好"
        },
        mood: {
          state: "value",
          value: "愉快"
        },
        energy: {
          state: "value",
          value: "充足"
        },
        concentration: {
          state: "value",
          value: "集中"
        },
        functionalImpact: {
          state: "none",
          values: []
        },
        context: {
          state: "value",
          values: ["周一，新的一周开始"]
        }
      },
      actions: [],
      provenance: {
        origin: "agent_conversation",
        fieldSources: {}
      }
    }
  ]
};

export default demoData;
