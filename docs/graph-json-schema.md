# Graph JSON schema

The graph snapshot is the stable transport contract between the ROS 2 backend
and every frontend or export consumer. Version `0.1.0` is defined by the
machine-readable [JSON Schema](graph.schema.json).

## Top-level snapshot

Every WebSocket message and snapshot CLI result is one complete JSON object:

| Field | Type | Meaning |
| --- | --- | --- |
| `schema_version` | `"0.1.0"` | Transport contract version |
| `timestamp` | RFC 3339 string | Time at which discovery was sampled |
| `ros_domain_id` | string | ROS domain used by the backend |
| `nodes` | array | ROS entities in the snapshot |
| `edges` | array | Directed relationships between entities |

IDs are stable for the same ROS graph and are not random UUIDs. ROS names are
normalized to absolute names beginning with `/`.

## Node IDs and kinds

| Kind | ID form | Additional fields |
| --- | --- | --- |
| `ros_node` | `node:/namespace/name` | `name`, `namespace` |
| `ros_topic` | `topic:/topic_name` | optional `types` |
| `ros_service` | `service:/service_name` | optional `types` |
| `ros_action` | `action:/action_name` | optional `types` |

`types` is an array because ROS graph discovery can report multiple types for a
single resource name.

## Edge IDs and direction

An edge ID is `<kind>:<source>-><target>`. Direction is part of the contract:

| Kind | Direction |
| --- | --- |
| `publish` | node → topic |
| `subscribe` | topic → node |
| `service_client` | node → service |
| `service_server` | service → node |
| `action_client` | node → action |
| `action_server` | action → node |

Every edge endpoint must reference a node ID present in the same snapshot. Node
and edge IDs must each be unique within their collection.

## Compatibility

Consumers must reject unsupported major/minor schema versions rather than guess
at field semantics. Additive metadata requires a schema version update because
version `0.1.0` rejects unknown fields. The Python source of truth is
`backend/ros2_node_map/graph_model.py`; frontend equivalents are in
`app/src/types.ts`.

## Example

```json
{
  "schema_version": "0.1.0",
  "timestamp": "2026-07-08T12:00:00+08:00",
  "ros_domain_id": "0",
  "nodes": [
    {
      "id": "node:/talker",
      "kind": "ros_node",
      "label": "/talker",
      "name": "talker",
      "namespace": "/"
    },
    {
      "id": "topic:/chatter",
      "kind": "ros_topic",
      "label": "/chatter",
      "types": ["std_msgs/msg/String"]
    }
  ],
  "edges": [
    {
      "id": "publish:node:/talker->topic:/chatter",
      "kind": "publish",
      "source": "node:/talker",
      "target": "topic:/chatter"
    }
  ]
}
```
