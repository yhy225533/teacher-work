import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import {
  getSchemaVersion,
  runMigrations,
  type SqliteDatabase,
} from '../src/main/db/migrations'
import {
  LESSON_MATERIAL_GROUPS,
  isCreateLessonDocRequest,
  isLessonMaterialGroup,
  isManagedFileLink,
  isSetLessonMaterialGroupRequest,
  isSetLessonMaterialGroupResult,
} from '../src/shared/file-contracts'

const roots: string[] = []
const databases: SqliteDatabase[] = []

afterEach(() => {
  for (const database of databases.splice(0)) database.close()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function createMigratedDatabase(): SqliteDatabase {
  const root = mkdtempSync(join(tmpdir(), 'teacher-workbench-v113-'))
  roots.push(root)
  const database = new Database(join(root, 'workspace.db')) as SqliteDatabase
  databases.push(database)
  runMigrations(database)
  return database
}

describe('V1.13/D74 lesson_files.role 迁移与合同', () => {
  it('migration v18 adds the role column with the four-value CHECK and keeps rows NULL', () => {
    const database = createMigratedDatabase()
    expect(getSchemaVersion(database)).toBe(18)

    const columns = database.prepare('PRAGMA table_info(lesson_files)').all() as Array<{ name: string }>
    expect(columns.map((column) => column.name)).toContain('role')

    // 旧行语义：role 为 NULL（自动）
    database.exec(`
      INSERT INTO nodes (id, parent_id, kind, title, sort_order, created_at, updated_at)
        VALUES ('node-lesson', NULL, 'lesson', '课次', 0, '2026-01-01', '2026-01-01');
      INSERT INTO files (id, original_name, size_bytes, mime_type, created_at, updated_at)
        VALUES ('file-1', '讲义.md', 10, 'text/markdown', '2026-01-01', '2026-01-01');
    `)
    database.prepare(
      "INSERT INTO lesson_files (file_id, lesson_id, created_at) VALUES ('file-1', 'node-lesson', '2026-01-01')",
    ).run()
    const row = database.prepare('SELECT role FROM lesson_files WHERE file_id = \'file-1\'').get() as { role: string | null }
    expect(row.role).toBeNull()

    // CHECK：四组合法值可写，未知值拒绝
    database.prepare("UPDATE lesson_files SET role = 'exam' WHERE file_id = 'file-1'").run()
    expect(() =>
      database.prepare("UPDATE lesson_files SET role = 'homework' WHERE file_id = 'file-1'").run(),
    ).toThrow()
  })

  it('lesson material group contracts accept only the four values or null', () => {
    expect(LESSON_MATERIAL_GROUPS).toEqual(['lecture', 'exercise', 'exam', 'misc'])
    for (const group of LESSON_MATERIAL_GROUPS) expect(isLessonMaterialGroup(group)).toBe(true)
    expect(isLessonMaterialGroup('homework')).toBe(false)
    expect(isLessonMaterialGroup(null)).toBe(false)

    expect(isSetLessonMaterialGroupRequest({ fileId: 'file-1', group: null })).toBe(true)
    expect(isSetLessonMaterialGroupRequest({ fileId: 'file-1', group: 'lecture' })).toBe(true)
    expect(isSetLessonMaterialGroupRequest({ fileId: 'file-1', group: 'other' })).toBe(false)
    expect(isSetLessonMaterialGroupRequest({ fileId: 'file-1', group: null, extra: 1 })).toBe(false)

    expect(
      isManagedFileLink({ fileId: 'file-1', targetType: 'lesson', targetId: 'node-lesson', createdAt: '2026-01-01', role: 'exam' }),
    ).toBe(true)
    expect(
      isManagedFileLink({ fileId: 'file-1', targetType: 'student', targetId: 'student-1', createdAt: '2026-01-01' }),
    ).toBe(true)
    expect(
      isManagedFileLink({ fileId: 'file-1', targetType: 'lesson', targetId: 'node-lesson', createdAt: '2026-01-01', role: 'other' }),
    ).toBe(false)

    expect(isSetLessonMaterialGroupResult({ file: { id: 'file-1', originalName: 'a.md', sizeBytes: 1, mimeType: 'text/markdown', originFileId: null, mtimeMs: null, contentHash: null, createdAt: '2026-01-01', updatedAt: '2026-01-01', deletedAt: null }, group: null })).toBe(true)
    expect(isSetLessonMaterialGroupResult({ file: null, group: null })).toBe(false)
  })
})

describe('V1.14/D82 createLessonDoc 合同', () => {
  it('accepts lessonId + non-empty name within 80 chars, rejects forged payloads', () => {
    expect(isCreateLessonDocRequest({ lessonId: 'lesson-1', name: '复习讲义' })).toBe(true)
    expect(isCreateLessonDocRequest({ lessonId: 'lesson-1', name: '  ' })).toBe(false)
    expect(isCreateLessonDocRequest({ lessonId: 'lesson-1', name: '复习讲义'.repeat(21) })).toBe(false)
    expect(isCreateLessonDocRequest({ lessonId: 'lesson-1' })).toBe(false)
    expect(isCreateLessonDocRequest({ lessonId: 'lesson-1', name: '复习讲义', extra: 1 })).toBe(false)
    expect(isCreateLessonDocRequest({ lessonId: '', name: '复习讲义' })).toBe(false)
  })
})
