import { PrismaClient } from '@prisma/client'
import { isTriggerDue, getNextContentType } from '../lib/automation-helper'

const prisma = new PrismaClient()

async function main() {
    console.log("=== Testing Automation Helper Functions ===\n")

    // Test 1: Time matcher
    const nowUtc = new Date('2026-02-22T14:00:00.000Z') // A Sunday at 14:00 UTC
    console.log("Mock Current Time (UTC):", nowUtc.toUTCString())

    const triggers = [
        { day: 'Monday', time: '14:00' },
        { day: 'Everyday', time: '13:59' }, // 1 min diff -> true
        { day: 'Sunday', time: '14:05' },   // 5 min diff -> false
    ]
    console.log("Triggers:", triggers)
    console.log("isTriggerDue result (expected true for Everyday 13:59):", isTriggerDue(triggers, 'UTC', nowUtc))


    // Test 2: Content Type Sequencer
    const preferredTypes = ['TEXT', 'IMAGE', 'VIDEO']
    const userId = "test-user-id" // Replace or just mock the logic

    console.log("\n=== Sequence Calculator Test ===")
    const nextType = await getNextContentType(userId, preferredTypes)
    console.log("Next content type (assuming no history for test-user-id):", nextType, " (Expected TEXT)")

    console.log("\nAll tests ran successfully.")
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
